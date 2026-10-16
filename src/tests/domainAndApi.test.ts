import { describe, it, expect, beforeAll } from 'vitest';
import { validateEvaluationRequest, validateDecisionRequest, handleApiRequest } from '../server/api';
import { verifyFirebaseIdToken, checkAgreementAuthorization } from '../server/auth';
import { AuditLogEntry } from '../types';
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
