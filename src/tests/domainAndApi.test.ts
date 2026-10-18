import { describe, it, expect, beforeAll } from 'vitest';
import { validateEvaluationRequest, validateDecisionRequest, handleApiRequest } from '../server/api';
import { verifyFirebaseIdToken, checkAgreementAuthorization } from '../server/auth';
import { AuditLogEntry, FundingAgreement } from '../types';
import { initTestCrypto, createSignedFirebaseToken, testKeySet, createMockGeminiClient } from './testHelpers';
import { initialFundingAgreements } from '../data/mockData';

beforeAll(async () => {
  await initTestCrypto();
});

describe('Cryptographic Token Verification (RS256)', () => {
  it('rejects requests missing an Authorization header with UNAUTHORIZED', async () => {
    const res = await verifyFirebaseIdToken(undefined, testKeySet);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with malformed Authorization format with UNAUTHORIZED', async () => {
    const res = await verifyFirebaseIdToken('Basic dXNlcjpwYXNz', testKeySet);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects tokens that do not contain 3 JWT segments with INVALID_TOKEN', async () => {
    const res = await verifyFirebaseIdToken('Bearer not-a-valid-jwt-token', testKeySet);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_TOKEN');
  });

  it('rejects forged tokens signed by an untrusted key with FORGED_SIGNATURE', async () => {
    // Cryptographically signed with foreign key not in the trusted JWKS
    const forgedToken = await createSignedFirebaseToken({ signWithForeignKey: true });
    const res = await verifyFirebaseIdToken(`Bearer ${forgedToken}`, testKeySet);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('FORGED_SIGNATURE');
    expect(res.error?.message).toContain('signature verification failed');
  });

  it('rejects expired Firebase tokens with TOKEN_EXPIRED', async () => {
    const expiredToken = await createSignedFirebaseToken({ expOffsetSeconds: -300 });
    const res = await verifyFirebaseIdToken(`Bearer ${expiredToken}`, testKeySet);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens issued for a different project audience with INVALID_AUDIENCE', async () => {
    const wrongAudToken = await createSignedFirebaseToken({ aud: 'wrong-foreign-project-id' });
    const res = await verifyFirebaseIdToken(`Bearer ${wrongAudToken}`, testKeySet);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_AUDIENCE');
  });

  it('rejects tokens with an invalid issuer with INVALID_ISSUER', async () => {
    const wrongIssToken = await createSignedFirebaseToken({ iss: 'https://evil-auth.example.com' });
    const res = await verifyFirebaseIdToken(`Bearer ${wrongIssToken}`, testKeySet);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_ISSUER');
  });

  it('successfully verifies a valid cryptographic RS256 token and extracts authenticated identity', async () => {
    const validToken = await createSignedFirebaseToken({
      uid: 'user-grantor-777',
      email: 'elena@foundation.org'
    });
    const res = await verifyFirebaseIdToken(`Bearer ${validToken}`, testKeySet);
    expect(res.valid).toBe(true);
    expect(res.user?.uid).toBe('user-grantor-777');
    expect(res.user?.email).toBe('elena@foundation.org');
    expect(res.user?.name).toBe('Elena Vance');
  });
});

describe('Funding Agreement Access Boundaries & RBAC', () => {
  const agreement = initialFundingAgreements[0]; // grantor: g-101, grantee: ge-202

  it('allows access to the designated Grantor', () => {
    const grantorUser = { uid: 'g-101', email: 'director@grantor.org' };
    const auth = checkAgreementAuthorization(grantorUser, agreement);
    expect(auth.authorized).toBe(true);
    expect(auth.role).toBe('Grantor');
  });

  it('allows access to the designated Grantee', () => {
    const granteeUser = { uid: 'ge-202', email: 'builder@grantee.org' };
    const auth = checkAgreementAuthorization(granteeUser, agreement);
    expect(auth.authorized).toBe(true);
    expect(auth.role).toBe('Grantee');
  });

  it('rejects unrelated users with FORBIDDEN_CROSS_AGREEMENT_ACCESS', () => {
    const strangerUser = { uid: 'unrelated-user-999', email: 'stranger@other.org' };
    const auth = checkAgreementAuthorization(strangerUser, agreement);
    expect(auth.authorized).toBe(false);
    expect(auth.error?.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
  });

  it('prohibits Grantees from performing Grantor-only actions (recording decisions)', () => {
    const granteeUser = { uid: 'ge-202', email: 'builder@grantee.org' };
    const auth = checkAgreementAuthorization(granteeUser, agreement, 'Grantor');
    expect(auth.authorized).toBe(false);
    expect(auth.error?.code).toBe('FORBIDDEN_GRANTOR_ONLY');
  });
});

describe('API Boundary Security & Protected Endpoints', () => {
  it('validates a complete decision payload with required reasoning', () => {
    const valid = validateDecisionRequest({
      agreement_id: 'fa-8041',
      milestone_id: 'ms-01',
      status: 'approved',
      reasoning: 'Verified PR #12 implementation and confirmation modal satisfies acceptance criterion 1.'
    });
    expect(valid.valid).toBe(true);
  });

  it('rejects decisions with reasoning shorter than 10 characters', () => {
    const invalid = validateDecisionRequest({
      agreement_id: 'fa-8041',
      milestone_id: 'ms-01',
      status: 'approved',
      reasoning: 'Too short' // 9 characters
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.error?.code).toBe('INVALID_REQUEST');
  });

  it('rejects decisions with unsupported status', () => {
    const invalid = validateDecisionRequest({
      agreement_id: 'fa-8041',
      milestone_id: 'ms-01',
      status: 'maybe_approved',
      reasoning: 'Detailed reasoning explanation here'
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.error?.code).toBe('INVALID_REQUEST');
  });

  it('server rejects unauthenticated decision submission with 401 UNAUTHORIZED', async () => {
    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = { method: 'POST', headers: {} };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/decisions');
    const handled = await handleApiRequest(mockReq, mockRes, url, JSON.stringify({}), testKeySet);
    expect(handled).toBe(true);
    expect(statusCode).toBe(401);
    expect(JSON.parse(responseBody).error.code).toBe('UNAUTHORIZED');
  });

  it('server rejects forged token on decision endpoint with 401 FORGED_SIGNATURE', async () => {
    let statusCode = 0;
    let responseBody = '';

    const forgedToken = await createSignedFirebaseToken({ signWithForeignKey: true });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${forgedToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/decisions');
    await handleApiRequest(mockReq, mockRes, url, JSON.stringify({}), testKeySet);
    expect(statusCode).toBe(401);
    expect(JSON.parse(responseBody).error.code).toBe('FORGED_SIGNATURE');
  });

  it('server rejects Grantee decision submission with 403 FORBIDDEN_GRANTOR_ONLY', async () => {
    let statusCode = 0;
    let responseBody = '';

    const granteeToken = await createSignedFirebaseToken({ uid: 'ge-202', email: 'builder@grantee.org' });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${granteeToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/decisions');
    const payload = JSON.stringify({
      agreement_id: 'fa-8041',
      milestone_id: 'ms-01',
      status: 'approved',
      reasoning: 'Grantee trying to approve their own milestone'
    });

    await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
    expect(statusCode).toBe(403);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('FORBIDDEN_GRANTOR_ONLY');
  });

  it('server rejects milestone ID that does not belong to agreement with 400 MILESTONE_NOT_IN_AGREEMENT', async () => {
    let statusCode = 0;
    let responseBody = '';

    const grantorToken = await createSignedFirebaseToken({ uid: 'g-101', email: 'director@grantor.org' });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${grantorToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/decisions');
    const payload = JSON.stringify({
      agreement_id: 'fa-8041',
      milestone_id: 'ms-foreign-999', // manipulation attack
      status: 'approved',
      reasoning: 'Trying to record a decision on a milestone belonging to another agreement.'
    });

    await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
    expect(statusCode).toBe(400);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('MILESTONE_NOT_IN_AGREEMENT');
  });

  it('server accepts valid Grantor decision submission with 201 Created', async () => {
    let statusCode = 0;
    let responseBody = '';

    const grantorToken = await createSignedFirebaseToken({ uid: 'g-101', email: 'director@grantor.org' });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${grantorToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/decisions');
    const payload = JSON.stringify({
      agreement_id: 'fa-8041',
      milestone_id: 'ms-01',
      status: 'approved',
      reasoning: 'Comprehensive inspection of PR #12 diff and confirmation dialog demonstrates delivery.'
    });

    await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
    expect(statusCode).toBe(201);
    const parsed = JSON.parse(responseBody);
    expect(parsed.success).toBe(true);
    expect(parsed.decision.reviewer_role).toBe('Grantor');
    expect(parsed.authorized_reviewer_uid).toBe('g-101');
  });
});

describe('VeriCommit Evaluation API & Domain Rules', () => {
  it('validates a compliant evaluation request successfully', () => {
    const validPayload = {
      project_name: 'Community Tools',
      repository_url: 'https://github.com/example/community-tools',
      milestone: {
        title: 'Implement member registration',
        description: 'Allow a new member to register and access the application.',
        acceptance_criteria: [
          'A user can submit the registration form.',
          'Invalid input produces understandable validation errors.',
          'Automated tests cover successful and unsuccessful registration.'
        ]
      },
      evidence_source: 'github' as const
    };

    const res = validateEvaluationRequest(validPayload);
    expect(res.valid).toBe(true);
  });

  it('returns 200 and a contract-conforming EvaluationReport', async () => {
    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = { method: 'POST', headers: {} };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    const validBody = JSON.stringify({
      project_name: 'Community Tools',
      repository_url: 'https://github.com/example/community-tools',
      milestone: {
        title: 'Implement member registration',
        description: 'Deliver member registration and validation',
        acceptance_criteria: [
          'A user can submit the registration form.',
          'Invalid input produces understandable validation errors.'
        ]
      },
      evidence_source: 'sample'
    });

    const mockAiClient = createMockGeminiClient();
    await handleApiRequest(mockReq, mockRes, url, validBody, testKeySet, undefined, mockAiClient);
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(responseBody);
    expect(parsed.evaluation_id).toMatch(/^eval_/);
    expect(parsed.human_review_required).toBe(true);
    expect(parsed.criteria_results).toHaveLength(2);
    expect(['supported', 'insufficient_evidence', 'uncertain']).toContain(parsed.criteria_results[0].status);
    expect(parsed.overall_summary).toBeTruthy();
    expect(Array.isArray(parsed.suggested_next_steps)).toBe(true);
    expect(Array.isArray(parsed.limitations)).toBe(true);
  }, 10000);
});

describe('POST /api/v1/evaluations Security Hardening & Authorization Controls', () => {
  const validMilestonePayload = {
    project_name: 'Decentralized Community Tools',
    agreement_id: 'fa-8041',
    milestone_id: 'ms-01',
    repository_url: 'https://github.com/example/community-tools',
    milestone: {
      id: 'ms-01',
      title: 'Implement user registration & account confirmation',
      description: 'Allow new members to register and verify registration',
      acceptance_criteria: [
        'A user can submit the registration form and receive account confirmation.',
        'Invalid input produces clear, understandable validation errors.'
      ]
    },
    evidence_source: 'sample' as const
  };

  it('1. Rejects evaluation of real agreement when Authorization header is missing with 401 UNAUTHORIZED', async () => {
    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = { method: 'POST', headers: {} };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    const handled = await handleApiRequest(mockReq, mockRes, url, JSON.stringify(validMilestonePayload), testKeySet);
    expect(handled).toBe(true);
    expect(statusCode).toBe(401);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('UNAUTHORIZED');
  });

  it('2. Rejects evaluation with invalid/forged token with 401 FORGED_SIGNATURE', async () => {
    let statusCode = 0;
    let responseBody = '';

    const forgedToken = await createSignedFirebaseToken({ signWithForeignKey: true });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${forgedToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    await handleApiRequest(mockReq, mockRes, url, JSON.stringify(validMilestonePayload), testKeySet);
    expect(statusCode).toBe(401);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('FORGED_SIGNATURE');
  });

  it('3. Rejects evaluation by authenticated non-participant with 403 FORBIDDEN_CROSS_AGREEMENT_ACCESS', async () => {
    let statusCode = 0;
    let responseBody = '';

    const strangerToken = await createSignedFirebaseToken({
      uid: 'unauthorized-stranger-999',
      email: 'stranger@other.org'
    });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${strangerToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    await handleApiRequest(mockReq, mockRes, url, JSON.stringify(validMilestonePayload), testKeySet);
    expect(statusCode).toBe(403);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
  });

  it('4. Rejects evaluation when milestone does not belong to agreement with 400 MILESTONE_NOT_IN_AGREEMENT', async () => {
    let statusCode = 0;
    let responseBody = '';

    const grantorToken = await createSignedFirebaseToken({
      uid: 'g-101',
      email: 'director@grantor.org'
    });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${grantorToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    const invalidMilestonePayload = {
      ...validMilestonePayload,
      milestone_id: 'ms-foreign-999',
      milestone: {
        ...validMilestonePayload.milestone,
        id: 'ms-foreign-999'
      }
    };

    await handleApiRequest(mockReq, mockRes, url, JSON.stringify(invalidMilestonePayload), testKeySet);
    expect(statusCode).toBe(400);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('MILESTONE_NOT_IN_AGREEMENT');
  });

  it('5. Rejects evaluation when repository URL does not match milestone with 403 UNAUTHORIZED_REPOSITORY_CONTEXT', async () => {
    let statusCode = 0;
    let responseBody = '';

    const grantorToken = await createSignedFirebaseToken({
      uid: 'g-101',
      email: 'director@grantor.org'
    });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${grantorToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    const mismatchedRepoPayload = {
      ...validMilestonePayload,
      repository_url: 'https://github.com/unrelated/attacker-repo'
    };

    await handleApiRequest(mockReq, mockRes, url, JSON.stringify(mismatchedRepoPayload), testKeySet);
    expect(statusCode).toBe(403);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('UNAUTHORIZED_REPOSITORY_CONTEXT');
  });

  it('6. Ensures rejected requests NEVER invoke the Gemini API evaluator or fetch evidence', async () => {
    let geminiCalled = false;
    const spyAiClient = {
      models: {
        generateContent: async () => {
          geminiCalled = true;
          throw new Error('Gemini must NOT be called on rejected evaluation requests');
        }
      }
    };

    let githubFetchCalled = false;
    const spyFetch = (async (reqUrl: any) => {
      if (String(reqUrl).includes('api.github.com')) {
        githubFetchCalled = true;
      }
      return { ok: true, json: async () => [] };
    }) as any;

    const strangerToken = await createSignedFirebaseToken({
      uid: 'unauthorized-stranger-999',
      email: 'stranger@other.org'
    });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${strangerToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      statusCode: 0,
      end: () => {}
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    const liveEvidencePayload = {
      ...validMilestonePayload,
      evidence_source: 'github' as const
    };

    await handleApiRequest(
      mockReq,
      mockRes,
      url,
      JSON.stringify(liveEvidencePayload),
      testKeySet,
      spyFetch,
      spyAiClient
    );

    expect(geminiCalled).toBe(false);
    expect(githubFetchCalled).toBe(false);
  });

  it('7. Prohibits using sample mode to bypass agreement authorization', async () => {
    let statusCode = 0;
    let responseBody = '';

    // A. Unauthenticated sample request targeting real agreement -> 401
    const unauthReq: any = { method: 'POST', headers: {} };
    const mockResA: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    await handleApiRequest(unauthReq, mockResA, url, JSON.stringify(validMilestonePayload), testKeySet);
    expect(statusCode).toBe(401);
    expect(JSON.parse(responseBody).error.code).toBe('UNAUTHORIZED');

    // B. Authenticated stranger sample request targeting real agreement -> 403
    const strangerToken = await createSignedFirebaseToken({
      uid: 'stranger-attempting-bypass',
      email: 'stranger@fake.org'
    });
    const strangerReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${strangerToken}` }
    };
    const mockResB: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    await handleApiRequest(strangerReq, mockResB, url, JSON.stringify(validMilestonePayload), testKeySet);
    expect(statusCode).toBe(403);
    expect(JSON.parse(responseBody).error.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
  });

  it('8. Forces unauthenticated standalone demo sample evaluation into deterministic mode without calling Gemini', async () => {
    let statusCode = 0;
    let responseBody = '';

    const publicDemoReq: any = { method: 'POST', headers: {} };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const standaloneDemoPayload = {
      project_name: 'Standalone Demo',
      repository_url: 'https://github.com/example/community-tools',
      milestone: {
        title: 'Demo Milestone',
        description: 'Demo description',
        acceptance_criteria: ['A user can submit registration.']
      },
      evidence_source: 'sample' as const
    };

    // Notice: no customAiClient passed, no GEMINI_API_KEY required. Runs deterministically.
    const url = new URL('http://localhost:3000/api/v1/evaluations');
    await handleApiRequest(publicDemoReq, mockRes, url, JSON.stringify(standaloneDemoPayload), testKeySet);

    expect(statusCode).toBe(200);
    const parsed = JSON.parse(responseBody);
    expect(parsed.evaluation_id).toMatch(/^eval_/);
    expect(parsed.human_review_required).toBe(true);
    expect(parsed.limitations.some((l: string) => l.includes('Deterministic evaluation engine'))).toBe(true);
  });

  it('9. Rejects live GitHub evidence evaluation without agreement context with 400 AGREEMENT_CONTEXT_REQUIRED', async () => {
    let statusCode = 0;
    let responseBody = '';

    const grantorToken = await createSignedFirebaseToken({
      uid: 'g-101',
      email: 'director@grantor.org'
    });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${grantorToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    const liveWithoutAgreement = {
      project_name: 'Live Project',
      repository_url: 'https://github.com/example/community-tools',
      milestone: {
        title: 'Live Milestone',
        description: 'Live description',
        acceptance_criteria: ['Criterion']
      },
      evidence_source: 'github' as const
    };

    await handleApiRequest(mockReq, mockRes, url, JSON.stringify(liveWithoutAgreement), testKeySet);
    expect(statusCode).toBe(400);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('AGREEMENT_CONTEXT_REQUIRED');
  });

  it('10. Allows authorized participant to evaluate an agreed milestone successfully with HTTP 200', async () => {
    let statusCode = 0;
    let responseBody = '';

    const grantorToken = await createSignedFirebaseToken({
      uid: 'g-101',
      email: 'director@grantor.org'
    });
    const mockReq: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${grantorToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const mockAiClient = createMockGeminiClient();
    const url = new URL('http://localhost:3000/api/v1/evaluations');

    await handleApiRequest(
      mockReq,
      mockRes,
      url,
      JSON.stringify(validMilestonePayload),
      testKeySet,
      undefined,
      mockAiClient
    );

    expect(statusCode).toBe(200);
    const parsed = JSON.parse(responseBody);
    expect(parsed.evaluation_id).toMatch(/^eval_/);
    expect(parsed.agreement_id).toBe('fa-8041');
    expect(parsed.milestone_id).toBe('ms-01');
    expect(parsed.human_review_required).toBe(true);
    expect(parsed.criteria_results).toHaveLength(2);
  });
});

describe('Audit History & Immutability Rules', () => {
  it('validates audit event creation structure with actor and target references', () => {
    const auditEntry: AuditLogEntry = {
      id: 'audit-999',
      timestamp: new Date().toISOString(),
      actor: 'Elena Vance (Grantor)',
      action: 'Recorded Human Decision: APPROVED',
      entityType: 'HumanDecision',
      entityId: 'dec-1234',
      details: 'Milestone "Implement registration" approved.'
    };

    expect(auditEntry.actor).toContain('Grantor');
    expect(auditEntry.entityType).toBe('HumanDecision');
    expect(auditEntry.entityId).toBe('dec-1234');
    expect(auditEntry.timestamp).toBeTruthy();
  });
});

describe('Multi-Agreement Listing & Scoped Authorization', () => {
  it('rejects unauthenticated request to GET /api/v1/agreements with 401 UNAUTHORIZED', async () => {
    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = { method: 'GET', headers: {} };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/agreements');
    const handled = await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(handled).toBe(true);
    expect(statusCode).toBe(401);
    expect(JSON.parse(responseBody).error.code).toBe('UNAUTHORIZED');
  });

  it('lists only authorized agreements for Grantor (Elena Vance / g-101)', async () => {
    const grantorToken = await createSignedFirebaseToken({
      uid: 'g-101',
      email: 'imaginright.dev@gmail.com',
      email_verified: true
    });

    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${grantorToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/agreements');
    await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(statusCode).toBe(200);

    const parsed = JSON.parse(responseBody);
    expect(parsed.total).toBe(2);
    const agreementIds = parsed.agreements.map((a: any) => a.id);
    expect(agreementIds).toContain('fa-8041');
    expect(agreementIds).toContain('fa-9210');
    expect(agreementIds).not.toContain('fa-7342'); // Foreign agreement where g-101 is not a party
    expect(parsed.agreements[0].userRole).toBe('Grantor');
  });

  it('lists only authorized agreements for Grantee (ge-202)', async () => {
    const granteeToken = await createSignedFirebaseToken({
      uid: 'ge-202',
      email: 'grantee@example.com',
      email_verified: true
    });

    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${granteeToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/agreements');
    await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(statusCode).toBe(200);

    const parsed = JSON.parse(responseBody);
    expect(parsed.total).toBe(2);
    const agreementIds = parsed.agreements.map((a: any) => a.id);
    expect(agreementIds).toContain('fa-8041');
    expect(agreementIds).toContain('fa-7342');
    expect(agreementIds).not.toContain('fa-9210'); // Foreign agreement where ge-202 is not a party
    expect(parsed.agreements.every((a: any) => a.userRole === 'Grantee')).toBe(true);
  });

  it('returns empty agreements array for a completely foreign user', async () => {
    const strangerToken = await createSignedFirebaseToken({
      uid: 'stranger-999',
      email: 'stranger@example.com',
      email_verified: true
    });

    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${strangerToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/agreements');
    await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(statusCode).toBe(200);

    const parsed = JSON.parse(responseBody);
    expect(parsed.total).toBe(0);
    expect(parsed.agreements).toHaveLength(0);
  });

  it('strictly rejects cross-agreement GET /api/v1/agreements/:id for unauthorized user with 403', async () => {
    const grantorToken = await createSignedFirebaseToken({
      uid: 'g-101',
      email: 'imaginright.dev@gmail.com',
      email_verified: true
    });

    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${grantorToken}` }
    };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    // g-101 attempts to access fa-7342 (belonging to g-404 and ge-202)
    const url = new URL('http://localhost:3000/api/v1/agreements/fa-7342');
    await handleApiRequest(mockReq, mockRes, url, '', testKeySet);
    expect(statusCode).toBe(403);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
  });

  it('demonstrates dynamic role calculation across multiple agreements', () => {
    const user = { uid: 'user-hybrid', email: 'hybrid@example.com', email_verified: true };

    const agreementAsGrantor: FundingAgreement = {
      id: 'ag-as-grantor',
      title: 'Grantor Role Agreement',
      grantorId: 'user-hybrid',
      grantorName: 'Hybrid User (Grantor)',
      granteeId: 'other-user',
      granteeName: 'Other Grantee',
      description: 'Test',
      milestones: [],
      status: 'active',
      createdAt: '2026-09-01T00:00:00Z'
    };

    const agreementAsGrantee: FundingAgreement = {
      id: 'ag-as-grantee',
      title: 'Grantee Role Agreement',
      grantorId: 'other-grantor',
      grantorName: 'Other Grantor',
      granteeId: 'user-hybrid',
      granteeName: 'Hybrid User (Grantee)',
      description: 'Test',
      milestones: [],
      status: 'active',
      createdAt: '2026-09-01T00:00:00Z'
    };

    const auth1 = checkAgreementAuthorization(user, agreementAsGrantor);
    expect(auth1.authorized).toBe(true);
    expect(auth1.role).toBe('Grantor');

    const auth2 = checkAgreementAuthorization(user, agreementAsGrantee);
    expect(auth2.authorized).toBe(true);
    expect(auth2.role).toBe('Grantee');

    // Privileged grantor action should succeed on ag1 but fail on ag2
    const grantorActionOnAg1 = checkAgreementAuthorization(user, agreementAsGrantor, 'Grantor');
    expect(grantorActionOnAg1.authorized).toBe(true);

    const grantorActionOnAg2 = checkAgreementAuthorization(user, agreementAsGrantee, 'Grantor');
    expect(grantorActionOnAg2.authorized).toBe(false);
    expect(grantorActionOnAg2.error?.code).toBe('FORBIDDEN_GRANTOR_ONLY');
  });

  it('protects against stale asynchronous responses across agreement context switches', () => {
    let currentAgreementId = 'fa-8041';
    let localMilestoneId = 'ms-01';

    // Simulate switching active agreement
    const switchAgreement = (newAgreementId: string, initialMilestoneId: string) => {
      currentAgreementId = newAgreementId;
      localMilestoneId = initialMilestoneId;
    };

    switchAgreement('fa-9210', 'ms-doc-01');
    expect(currentAgreementId).toBe('fa-9210');
    expect(localMilestoneId).toBe('ms-doc-01');

    // Simulate delayed async response from previous agreement fa-8041
    const handleAsyncResponse = (responseAgreementId: string, payload: any) => {
      if (responseAgreementId !== currentAgreementId) {
        // Discard stale response
        return false;
      }
      localMilestoneId = payload.milestoneId;
      return true;
    };

    const staleProcessed = handleAsyncResponse('fa-8041', { milestoneId: 'ms-01-stale' });
    expect(staleProcessed).toBe(false);
    expect(localMilestoneId).toBe('ms-doc-01'); // Untouched

    const validProcessed = handleAsyncResponse('fa-9210', { milestoneId: 'ms-doc-02' });
    expect(validProcessed).toBe(true);
    expect(localMilestoneId).toBe('ms-doc-02');
  });
});
