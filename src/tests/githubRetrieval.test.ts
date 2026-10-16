import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseGithubRepoUrl, fetchGithubEvidence } from '../server/github';
import { handleApiRequest } from '../server/api';
import { initTestCrypto, createSignedFirebaseToken, testKeySet } from './testHelpers';

beforeAll(async () => {
  await initTestCrypto();
});

describe('1. GitHub Repository URL Parsing & Security Rules', () => {
  it('parses valid standard HTTPS GitHub repository URLs', () => {
    const parsed = parseGithubRepoUrl('https://github.com/Pafekzy/product-poc1');
    expect(parsed.owner).toBe('Pafekzy');
    expect(parsed.repo).toBe('product-poc1');
    expect(parsed.normalizedUrl).toBe('https://github.com/Pafekzy/product-poc1');
    expect(parsed.branch).toBeUndefined();
  });

  it('normalizes trailing slashes and .git extensions', () => {
    const parsedWithSlash = parseGithubRepoUrl('https://github.com/Pafekzy/product-poc1/');
    expect(parsedWithSlash.normalizedUrl).toBe('https://github.com/Pafekzy/product-poc1');

    const parsedWithGit = parseGithubRepoUrl('https://github.com/Pafekzy/product-poc1.git');
    expect(parsedWithGit.normalizedUrl).toBe('https://github.com/Pafekzy/product-poc1');

    const parsedBoth = parseGithubRepoUrl('https://github.com/Pafekzy/product-poc1.git/');
    expect(parsedBoth.normalizedUrl).toBe('https://github.com/Pafekzy/product-poc1');
  });

  it('safely extracts branch from supported tree/{branch} and blob/{branch} deep links', () => {
    const tree = parseGithubRepoUrl('https://github.com/Pafekzy/product-poc1/tree/main');
    expect(tree.owner).toBe('Pafekzy');
    expect(tree.repo).toBe('product-poc1');
    expect(tree.branch).toBe('main');

    const nestedBranch = parseGithubRepoUrl('https://github.com/Pafekzy/product-poc1/tree/feature/verification-flow');
    expect(nestedBranch.branch).toBe('feature/verification-flow');

    const blob = parseGithubRepoUrl('https://github.com/Pafekzy/product-poc1/blob/dev');
    expect(blob.branch).toBe('dev');
  });

  it('rejects malformed URLs, non-HTTPS protocols, and non-GitHub hosts', () => {
    expect(() => parseGithubRepoUrl('not-a-url')).toThrow();
    expect(() => parseGithubRepoUrl('http://github.com/Pafekzy/product-poc1')).toThrow();
    expect(() => parseGithubRepoUrl('https://gitlab.com/Pafekzy/product-poc1')).toThrow();
    expect(() => parseGithubRepoUrl('https://evil.github.com/Pafekzy/product-poc1')).toThrow();
    expect(() => parseGithubRepoUrl('https://gist.github.com/Pafekzy/product-poc1')).toThrow();
  });

  it('rejects unexpected ports, credentials, and SSRF/path-traversal attempts', () => {
    // Port
    expect(() => parseGithubRepoUrl('https://github.com:8443/Pafekzy/product-poc1')).toThrow();
    // Credentials
    expect(() => parseGithubRepoUrl('https://user:pass@github.com/Pafekzy/product-poc1')).toThrow();
    // Path traversal / SSRF
    expect(() => parseGithubRepoUrl('https://github.com/../evil')).toThrow();
    expect(() => parseGithubRepoUrl('https://github.com/owner/..')).toThrow();
    expect(() => parseGithubRepoUrl('https://github.com/')).toThrow();
    expect(() => parseGithubRepoUrl('https://github.com/onlyowner')).toThrow();
  });
});

describe('2. GitHub Normalization, Deduplication & Missing Field Resilience', () => {
  const sampleCommits = [
    {
      sha: '1e3ae808f3c1a9bc',
      html_url: 'https://github.com/Pafekzy/product-poc1/commit/1e3ae808f3c1a9bc',
      commit: {
        message: 'Refine feature carousel ordering and autoplay\n\nFull details here.',
        author: { name: 'Elena Vance', date: '2026-10-16T10:00:00Z' }
      },
      author: { login: 'elena-vance', avatar_url: 'https://avatars.example.com/elena' }
    },
    // Duplicate sha to verify deduplication
    {
      sha: '1e3ae808f3c1a9bc',
      html_url: 'https://github.com/Pafekzy/product-poc1/commit/1e3ae808f3c1a9bc',
      commit: {
        message: 'Duplicate commit',
        author: { name: 'Elena Vance', date: '2026-10-16T10:00:00Z' }
      }
    },
    // Missing author and commit details
    {
      sha: '4a7e2b1000000000',
      commit: { message: '' }
    }
  ];

  const samplePRs = [
    {
      number: 12,
      title: 'Add member registration form',
      state: 'closed',
      merged_at: '2026-10-12T12:00:00Z',
      html_url: 'https://github.com/Pafekzy/product-poc1/pull/12',
      head: { ref: 'feature/registration' },
      base: { ref: 'main' },
      user: { login: 'maria-ui', avatar_url: 'https://avatars.example.com/maria' },
      created_at: '2026-10-10T10:00:00Z',
      updated_at: '2026-10-12T12:00:00Z'
    },
    // Duplicate PR to verify deduplication
    {
      number: 12,
      title: 'Duplicate PR 12'
    },
    // Missing fields PR
    {
      number: 14,
      title: null,
      state: 'open',
      merged_at: null
    }
  ];

  const mockFetch = (async (url: string) => {
    if (url.includes('/commits')) {
      return {
        ok: true,
        status: 200,
        json: async () => sampleCommits
      } as Response;
    }
    if (url.includes('/pulls')) {
      return {
        ok: true,
        status: 200,
        json: async () => samplePRs
      } as Response;
    }
    return { ok: false, status: 404 } as Response;
  }) as typeof fetch;

  it('normalizes commits and preserves metadata with live provenance', async () => {
    const res = await fetchGithubEvidence({
      repoUrl: 'https://github.com/Pafekzy/product-poc1',
      fetchFn: mockFetch
    });

    expect(res.provenance).toBe('live');
    expect(res.isSample).toBe(false);
    expect(res.totalCommits).toBe(2); // Deduplicated from 3 to 2

    const firstCommit = res.commits[0];
    expect(firstCommit.sha).toBe('1e3ae808f3c1a9bc');
    expect(firstCommit.shortSha).toBe('1e3ae80');
    expect(firstCommit.title).toBe('Refine feature carousel ordering and autoplay');
    expect(firstCommit.author).toBe('elena-vance');
    expect(firstCommit.authorAvatarUrl).toBe('https://avatars.example.com/elena');
    expect(firstCommit.isSample).toBe(false);
    expect(firstCommit.provider).toBe('github');
  });

  it('gracefully handles missing author and commit message without failing', async () => {
    const res = await fetchGithubEvidence({
      repoUrl: 'https://github.com/Pafekzy/product-poc1',
      fetchFn: mockFetch
    });

    const secondCommit = res.commits[1];
    expect(secondCommit.title).toBe('Untitled commit');
    expect(secondCommit.author).toBe('Unknown');
  });

  it('normalizes pull requests with state, merge status, and deduplication', async () => {
    const res = await fetchGithubEvidence({
      repoUrl: 'https://github.com/Pafekzy/product-poc1',
      fetchFn: mockFetch
    });

    expect(res.totalPullRequests).toBe(2); // Deduplicated from 3 to 2

    const pr12 = res.pullRequests[0];
    expect(pr12.number).toBe(12);
    expect(pr12.state).toBe('merged');
    expect(pr12.isMerged).toBe(true);
    expect(pr12.headBranch).toBe('feature/registration');
    expect(pr12.baseBranch).toBe('main');
    expect(pr12.author).toBe('maria-ui');

    const pr14 = res.pullRequests[1];
    expect(pr14.number).toBe(14);
    expect(pr14.state).toBe('open');
    expect(pr14.isMerged).toBe(false);
    expect(pr14.title).toBe('Pull Request #14');
  });
});

describe('3. Error Handling, Rate Limiting & Timeout Safety', () => {
  it('maps HTTP 401 to GITHUB_AUTH_INVALID without leaking tokens', async () => {
    const mock401 = (async () => ({
      ok: false,
      status: 401,
      headers: new Headers()
    })) as any;

    try {
      await fetchGithubEvidence({
        repoUrl: 'https://github.com/Pafekzy/product-poc1',
        token: 'secret-token-12345',
        fetchFn: mock401
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_AUTH_INVALID');
      expect(err.status).toBe(401);
      expect(JSON.stringify(err)).not.toContain('secret-token-12345');
    }
  });

  it('maps HTTP 403 with x-ratelimit-remaining=0 to GITHUB_RATE_LIMITED', async () => {
    const mock403Rate = (async () => ({
      ok: false,
      status: 403,
      headers: new Headers({ 'x-ratelimit-remaining': '0' })
    })) as any;

    try {
      await fetchGithubEvidence({
        repoUrl: 'https://github.com/Pafekzy/product-poc1',
        fetchFn: mock403Rate
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_RATE_LIMITED');
      expect(err.status).toBe(403);
    }
  });

  it('maps HTTP 404 to GITHUB_REPO_NOT_FOUND', async () => {
    const mock404 = (async () => ({
      ok: false,
      status: 404,
      headers: new Headers()
    })) as any;

    try {
      await fetchGithubEvidence({
        repoUrl: 'https://github.com/Pafekzy/product-poc1',
        fetchFn: mock404
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_REPO_NOT_FOUND');
      expect(err.status).toBe(404);
    }
  });

  it('maps network abort/timeout to GITHUB_TIMEOUT (HTTP 504)', async () => {
    const mockTimeout = (async () => {
      const error: any = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    }) as any;

    try {
      await fetchGithubEvidence({
        repoUrl: 'https://github.com/Pafekzy/product-poc1',
        fetchFn: mockTimeout
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_TIMEOUT');
      expect(err.status).toBe(504);
    }
  });
});

describe('4. Protected Endpoint: GET /api/v1/evidence/github', () => {
  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = { method: 'GET', headers: {} };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evidence/github?repo_url=https://github.com/Pafekzy/product-poc1');
    const handled = await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(handled).toBe(true);
    expect(statusCode).toBe(401);
    expect(JSON.parse(responseBody).error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests missing agreement_id with 400 AGREEMENT_CONTEXT_REQUIRED', async () => {
    let statusCode = 0;
    let responseBody = '';

    const validToken = await createSignedFirebaseToken({ uid: 'g-101', email: 'director@grantor.org' });
    const mockReq: any = { method: 'GET', headers: { authorization: `Bearer ${validToken}` } };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evidence/github?repo_url=https://github.com/Pafekzy/product-poc1');
    await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(statusCode).toBe(400);
    expect(JSON.parse(responseBody).error.code).toBe('AGREEMENT_CONTEXT_REQUIRED');
  });

  it('rejects requests with unknown agreement_id with 404 AGREEMENT_NOT_FOUND', async () => {
    let statusCode = 0;
    let responseBody = '';

    const validToken = await createSignedFirebaseToken({ uid: 'g-101', email: 'director@grantor.org' });
    const mockReq: any = { method: 'GET', headers: { authorization: `Bearer ${validToken}` } };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evidence/github?repo_url=https://github.com/Pafekzy/product-poc1&agreement_id=fa-unknown');
    await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(statusCode).toBe(404);
    expect(JSON.parse(responseBody).error.code).toBe('AGREEMENT_NOT_FOUND');
  });

  it('rejects cross-agreement access by unauthorized user with 403 FORBIDDEN_CROSS_AGREEMENT_ACCESS', async () => {
    let statusCode = 0;
    let responseBody = '';

    const strangerToken = await createSignedFirebaseToken({ uid: 'unauthorized-user-999', email: 'stranger@other.org' });
    const mockReq: any = { method: 'GET', headers: { authorization: `Bearer ${strangerToken}` } };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evidence/github?repo_url=https://github.com/Pafekzy/product-poc1&agreement_id=fa-8041');
    await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(statusCode).toBe(403);
    expect(JSON.parse(responseBody).error.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
  });

  it('rejects repository not associated with the agreement with 403 UNAUTHORIZED_REPOSITORY_CONTEXT', async () => {
    let statusCode = 0;
    let responseBody = '';

    const grantorToken = await createSignedFirebaseToken({ uid: 'g-101', email: 'director@grantor.org' });
    const mockReq: any = { method: 'GET', headers: { authorization: `Bearer ${grantorToken}` } };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    // An arbitrary unlinked repo not associated with any milestone in fa-8041
    const url = new URL('http://localhost:3000/api/v1/evidence/github?repo_url=https://github.com/unrelated/foreign-repo&agreement_id=fa-8041');
    await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(statusCode).toBe(403);
    expect(JSON.parse(responseBody).error.code).toBe('UNAUTHORIZED_REPOSITORY_CONTEXT');
  });

  it('successfully returns normalized evidence for authorized user and linked repository', async () => {
    let statusCode = 0;
    let responseBody = '';

    const mockFetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          sha: '1e3ae808f3c1a9bc',
          commit: { message: 'Verified commit', author: { name: 'Elena Vance', date: '2026-10-16T10:00:00Z' } }
        }
      ]
    })) as any;

    const grantorToken = await createSignedFirebaseToken({ uid: 'g-101', email: 'director@grantor.org' });
    const mockReq: any = { method: 'GET', headers: { authorization: `Bearer ${grantorToken}` } };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evidence/github?repo_url=https://github.com/Pafekzy/product-poc1&agreement_id=fa-8041');
    await handleApiRequest(mockReq, mockRes, url, '', testKeySet, mockFetch);
    expect(statusCode).toBe(200);

    const parsed = JSON.parse(responseBody);
    expect(parsed.success).toBe(true);
    expect(parsed.provenance).toBe('live');
    expect(parsed.isSample).toBe(false);
    expect(parsed.repository.repo).toBe('product-poc1');
    expect(parsed.commits).toHaveLength(1);
    expect(parsed.commits[0].sha).toBe('1e3ae808f3c1a9bc');
  });
});

describe('5. Evidence Explorer UI Integration & Provenance Invariants', () => {
  const appPath = path.resolve(__dirname, '../App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  it('contains "Fetch Live GitHub Evidence" action button in Evidence Explorer', () => {
    expect(appSource).toContain('data-testid="fetch-live-evidence-btn"');
    expect(appSource).toContain('Fetch Live GitHub Evidence');
  });

  it('contains explicit provenance badges distinguishing live and sample datasets', () => {
    expect(appSource).toContain('Source: Live GitHub API');
    expect(appSource).toContain('Source: Sample Dataset');
    expect(appSource).toContain('data-testid="evidence-source-badge"');
  });

  it('renders live view and sample view containers separately without cross-contamination', () => {
    expect(appSource).toContain('data-testid="live-evidence-view"');
    expect(appSource).toContain('data-testid="sample-evidence-view"');
  });

  it('displays canonical external GitHub links with rel="noopener noreferrer"', () => {
    expect(appSource).toContain('target="_blank"');
    expect(appSource).toContain('rel="noopener noreferrer"');
    expect(appSource).toContain('View on GitHub');
  });

  it('reinforces evidence provenance rule that repository activity does not prove completion', () => {
    expect(appSource).toContain('Evidence Provenance Rule:');
    expect(appSource).toContain('Repository activity alone does not prove completion');
  });
});
