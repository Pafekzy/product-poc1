export interface ParsedGithubRepo {
  owner: string;
  repo: string;
  normalizedUrl: string;
  branch?: string;
}

export interface NormalizedCommitEvidence {
  id: string;
  type: 'commit';
  owner: string;
  repo: string;
  sha: string;
  shortSha: string;
  title: string;
  commitMessage: string;
  url: string;
  author: string;
  authorAvatarUrl?: string;
  committedAt: string;
  provider: 'github';
  retrievedAt: string;
  isSample: false;
}

export interface NormalizedPullRequestEvidence {
  id: string;
  type: 'pull_request';
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  isMerged: boolean;
  mergedAt?: string;
  url: string;
  headBranch?: string;
  baseBranch?: string;
  author: string;
  authorAvatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  provider: 'github';
  retrievedAt: string;
  isSample: false;
}

export interface GithubEvidenceResult {
  repository: {
    owner: string;
    repo: string;
    url: string;
    branch?: string;
  };
  retrievedAt: string;
  provenance: 'live';
  isSample: false;
  commits: NormalizedCommitEvidence[];
  pullRequests: NormalizedPullRequestEvidence[];
  totalCommits: number;
  totalPullRequests: number;
}

export interface GithubErrorResponse {
  code:
    | 'INVALID_REPOSITORY_URL'
    | 'UNSUPPORTED_REPOSITORY_HOST'
    | 'MALFORMED_URL'
    | 'GITHUB_AUTH_INVALID'
    | 'GITHUB_RATE_LIMITED'
    | 'GITHUB_FORBIDDEN'
    | 'GITHUB_REPO_NOT_FOUND'
    | 'GITHUB_TIMEOUT'
    | 'GITHUB_NETWORK_ERROR'
    | 'GITHUB_INVALID_RESPONSE';
  message: string;
  status: number;
}

// GitHub Username: alphanumeric, single hyphens, max 39 chars.
const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
// GitHub Repo: alphanumeric, hyphens, periods, underscores, max 100 chars. Cannot be . or ..
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]{1,100}$/;

/**
 * Parses and strictly validates a GitHub repository URL.
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/ (trailing slash)
 * - https://github.com/owner/repo.git (.git extension)
 * - https://github.com/owner/repo/tree/{branch} (deep link extraction)
 * - https://github.com/owner/repo/blob/{branch} (deep link extraction)
 * 
 * Rejects:
 * - non-https protocols
 * - non-github.com hosts
 * - ports, usernames, passwords
 * - SSRF attempts or invalid path segments
 */
export function parseGithubRepoUrl(rawUrl: string): ParsedGithubRepo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw {
      code: 'INVALID_REPOSITORY_URL',
      message: 'Repository URL is required and must be a string.',
      status: 400
    } as GithubErrorResponse;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw {
      code: 'MALFORMED_URL',
      message: 'Invalid URL format.',
      status: 400
    } as GithubErrorResponse;
  }

  // Enforce HTTPS
  if (parsed.protocol !== 'https:') {
    throw {
      code: 'INVALID_REPOSITORY_URL',
      message: 'Only secure HTTPS GitHub repository URLs are supported.',
      status: 400
    } as GithubErrorResponse;
  }

  // Enforce exact github.com host (no subdomains like evil.github.com, raw, gist, etc.)
  if (parsed.hostname.toLowerCase() !== 'github.com') {
    throw {
      code: 'UNSUPPORTED_REPOSITORY_HOST',
      message: `Unsupported repository host "${parsed.hostname}". Only "github.com" is permitted.`,
      status: 400
    } as GithubErrorResponse;
  }

  // Reject unexpected port or embedded credentials
  if (parsed.port || parsed.username || parsed.password) {
    throw {
      code: 'INVALID_REPOSITORY_URL',
      message: 'Repository URL must not contain custom ports or credentials.',
      status: 400
    } as GithubErrorResponse;
  }

  // Clean pathname into segments
  const segments = parsed.pathname
    .split('/')
    .filter((segment) => segment.length > 0);

  if (segments.length < 2) {
    throw {
      code: 'INVALID_REPOSITORY_URL',
      message: 'Repository URL must contain both an owner and a repository name.',
      status: 400
    } as GithubErrorResponse;
  }

  const owner = segments[0];
  let repo = segments[1];

  // Strip .git suffix if present
  if (repo.toLowerCase().endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  // Validate owner and repo syntax
  if (!GITHUB_OWNER_REGEX.test(owner)) {
    throw {
      code: 'INVALID_REPOSITORY_URL',
      message: `Invalid GitHub owner "${owner}".`,
      status: 400
    } as GithubErrorResponse;
  }

  if (!GITHUB_REPO_REGEX.test(repo) || repo === '.' || repo === '..') {
    throw {
      code: 'INVALID_REPOSITORY_URL',
      message: `Invalid GitHub repository name "${repo}".`,
      status: 400
    } as GithubErrorResponse;
  }

  let branch: string | undefined = undefined;

  // Support extracting tree/{branch} or blob/{branch}
  if (segments.length >= 4 && (segments[2] === 'tree' || segments[2] === 'blob')) {
    // Branch may contain slashes (e.g. feature/auth)
    const branchCandidate = segments.slice(3).join('/');
    if (/^[a-zA-Z0-9_.\-\/]{1,100}$/.test(branchCandidate) && !branchCandidate.includes('..')) {
      branch = branchCandidate;
    }
  } else if (segments.length > 2) {
    // Disallow arbitrary nested paths that cannot be safely resolved
    throw {
      code: 'INVALID_REPOSITORY_URL',
      message: 'Repository URL contains unsupported path segments.',
      status: 400
    } as GithubErrorResponse;
  }

  return {
    owner,
    repo,
    normalizedUrl: `https://github.com/${owner}/${repo}`,
    branch
  };
}

export interface FetchGithubEvidenceOptions {
  repoUrl: string;
  branch?: string;
  since?: string;
  token?: string;
  fetchFn?: typeof fetch;
}

/**
 * Retrieves real commits and pull requests from GitHub REST API.
 * Uses bounded retrieval limits (20 items max) and timeouts.
 */
export async function fetchGithubEvidence(
  options: FetchGithubEvidenceOptions
): Promise<GithubEvidenceResult> {
  const { repoUrl, token, fetchFn = fetch } = options;
  const parsedRepo = parseGithubRepoUrl(repoUrl);

  const selectedBranch = options.branch || parsedRepo.branch;

  // Validate optional since timestamp
  let validatedSinceIso: string | undefined;
  if (options.since) {
    const parsedDate = new Date(options.since);
    if (isNaN(parsedDate.getTime())) {
      throw {
        code: 'INVALID_REQUEST',
        message: 'Parameter "since" must be a valid ISO-8601 date string.',
        status: 400
      };
    }
    validatedSinceIso = parsedDate.toISOString();
  }

  // Construct bounded, safe GitHub API URLs
  const baseApi = 'https://api.github.com';
  const ownerEnc = encodeURIComponent(parsedRepo.owner);
  const repoEnc = encodeURIComponent(parsedRepo.repo);

  const commitQuery = new URLSearchParams();
  commitQuery.set('per_page', '20');
  if (selectedBranch) commitQuery.set('sha', selectedBranch);
  if (validatedSinceIso) commitQuery.set('since', validatedSinceIso);

  const pullsQuery = new URLSearchParams();
  pullsQuery.set('state', 'all');
  pullsQuery.set('per_page', '20');

  const commitsUrl = `${baseApi}/repos/${ownerEnc}/${repoEnc}/commits?${commitQuery.toString()}`;
  const pullsUrl = `${baseApi}/repos/${ownerEnc}/${repoEnc}/pulls?${pullsQuery.toString()}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'VeriCommit-Verification-Agent/1.0'
  };

  if (token && token.trim().length > 0) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  const makeRequest = async (url: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetchFn(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const rateRemaining = res.headers?.get?.('x-ratelimit-remaining');
        if (res.status === 401) {
          throw {
            code: 'GITHUB_AUTH_INVALID',
            message: 'GitHub API authentication failed. Verify server token configuration.',
            status: 401
          } as GithubErrorResponse;
        }

        if (res.status === 403) {
          if (rateRemaining === '0') {
            throw {
              code: 'GITHUB_RATE_LIMITED',
              message: 'GitHub API rate limit exceeded. Please retry later or configure GITHUB_TOKEN on the server.',
              status: 403
            } as GithubErrorResponse;
          }
          throw {
            code: 'GITHUB_FORBIDDEN',
            message: 'Access to the specified GitHub repository was denied.',
            status: 403
          } as GithubErrorResponse;
        }

        if (res.status === 404) {
          throw {
            code: 'GITHUB_REPO_NOT_FOUND',
            message: `GitHub repository "${parsedRepo.owner}/${parsedRepo.repo}" not found or inaccessible.`,
            status: 404
          } as GithubErrorResponse;
        }

        throw {
          code: 'GITHUB_INVALID_RESPONSE',
          message: `GitHub API responded with unexpected HTTP status ${res.status}.`,
          status: res.status
        } as GithubErrorResponse;
      }

      return await res.json();
    } catch (err: any) {
      if (err.code && err.status) {
        throw err;
      }
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
        throw {
          code: 'GITHUB_TIMEOUT',
          message: 'GitHub API request timed out after 8 seconds.',
          status: 504
        } as GithubErrorResponse;
      }
      throw {
        code: 'GITHUB_NETWORK_ERROR',
        message: 'Failed to communicate with GitHub API.',
        status: 502
      } as GithubErrorResponse;
    }
  };

  // Perform parallel bounded requests
  const [rawCommits, rawPulls] = await Promise.all([
    makeRequest(commitsUrl),
    makeRequest(pullsUrl)
  ]);

  const retrievedAt = new Date().toISOString();

  // Deduplicate and normalize commits
  const seenCommitShas = new Set<string>();
  const commits: NormalizedCommitEvidence[] = [];

  if (Array.isArray(rawCommits)) {
    for (const c of rawCommits) {
      if (!c || !c.sha || seenCommitShas.has(c.sha)) continue;
      seenCommitShas.add(c.sha);

      const rawMsg = (c.commit?.message || '').trim();
      const firstLine = rawMsg ? rawMsg.split('\n')[0].trim() : 'Untitled commit';
      const commitMsg = rawMsg || 'Untitled commit';

      commits.push({
        id: `commit-${c.sha}`,
        type: 'commit',
        owner: parsedRepo.owner,
        repo: parsedRepo.repo,
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        title: firstLine,
        commitMessage: commitMsg,
        url: c.html_url || `${parsedRepo.normalizedUrl}/commit/${c.sha}`,
        author: c.author?.login || c.commit?.author?.name || 'Unknown',
        authorAvatarUrl: c.author?.avatar_url,
        committedAt: c.commit?.author?.date || c.commit?.committer?.date || retrievedAt,
        provider: 'github',
        retrievedAt,
        isSample: false
      });
    }
  }

  // Deduplicate and normalize pull requests
  const seenPrNumbers = new Set<number>();
  const pullRequests: NormalizedPullRequestEvidence[] = [];

  if (Array.isArray(rawPulls)) {
    for (const pr of rawPulls) {
      if (!pr || typeof pr.number !== 'number' || seenPrNumbers.has(pr.number)) continue;
      seenPrNumbers.add(pr.number);

      const isMerged = Boolean(pr.merged_at);
      const state: 'open' | 'closed' | 'merged' = isMerged ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';

      // Optional branch filter on PRs
      if (selectedBranch && pr.head?.ref !== selectedBranch && pr.base?.ref !== selectedBranch) {
        continue;
      }

      pullRequests.push({
        id: `pr-${pr.number}`,
        type: 'pull_request',
        owner: parsedRepo.owner,
        repo: parsedRepo.repo,
        number: pr.number,
        title: pr.title || `Pull Request #${pr.number}`,
        state,
        isMerged,
        mergedAt: pr.merged_at || undefined,
        url: pr.html_url || `${parsedRepo.normalizedUrl}/pull/${pr.number}`,
        headBranch: pr.head?.ref,
        baseBranch: pr.base?.ref,
        author: pr.user?.login || 'Unknown',
        authorAvatarUrl: pr.user?.avatar_url,
        createdAt: pr.created_at || retrievedAt,
        updatedAt: pr.updated_at || retrievedAt,
        provider: 'github',
        retrievedAt,
        isSample: false
      });
    }
  }

  return {
    repository: {
      owner: parsedRepo.owner,
      repo: parsedRepo.repo,
      url: parsedRepo.normalizedUrl,
      branch: selectedBranch
    },
    retrievedAt,
    provenance: 'live',
    isSample: false,
    commits,
    pullRequests,
    totalCommits: commits.length,
    totalPullRequests: pullRequests.length
  };
}
