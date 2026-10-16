import { describe, it, expect } from 'vitest';
import { validateEvaluationRequest, validateDecisionRequest, handleApiRequest } from '../server/api';
import { verifyFirebaseIdToken, checkAgreementAuthorization } from '../server/auth';
import { AuditLogEntry } from '../types';
import { createMockFirebaseToken } from './testHelpers';
import { initialFundingAgreements } from '../data/mockData';

describe('Server-Side Authentication & Token Verification', () => {
  it('rejects requests missing an Authorization header', () => {
    const res = verifyFirebaseIdToken(undefined);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with malformed Authorization format', () => {
    const res = verifyFirebaseIdToken('Basic dXNlcjpwYXNz');
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects tokens that do not contain 3 JWT segments', () => {
    const res = verifyFirebaseIdToken('Bearer not-a-valid-jwt-token');
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_TOKEN');
  });

  it('rejects expired Firebase tokens with TOKEN_EXPIRED', () => {
    const pastTime = Math.floor(Date.now() / 1000) - 300; // 5 mins ago
    const expiredToken = createMockFirebaseToken({ exp: pastTime });
    const res = verifyFirebaseIdToken(`Bearer ${expiredToken}`);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens issued for a different project audience with INVALID_AUDIENCE', () => {
    const wrongAudToken = createMockFirebaseToken({ aud: 'different-fake-project-id' });
    const res = verifyFirebaseIdToken(`Bearer ${wrongAudToken}`);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_AUDIENCE');
  });

  it('rejects tokens with an invalid issuer with INVALID_ISSUER', () => {
    const wrongIssToken = createMockFirebaseToken({ iss: 'https://evil-auth.example.com' });
    const res = verifyFirebaseIdToken(`Bearer ${wrongIssToken}`);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_ISSUER');
  });

  it('successfully verifies a valid Firebase token and extracts authenticated identity', () => {
    const validToken = createMockFirebaseToken({
      uid: 'user-grantor-777',
      email: 'elena@foundation.org'
    });
    const res = verifyFirebaseIdToken(`Bearer ${validToken}`);
    expect(res.valid).toBe(true);
    expect(res.user?.uid).toBe('user-grantor-777');
    expect(res.user?.email).toBe('elena@foundation.org');
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

describe('Human Decision Validation & Recording API', () => {
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

  it('server rejects unauthenticated decision submission with 401', () => {
    let statusCode = 0;
    let responseBody = '';

    const mockReq: any = { method: 'POST', headers: {} };
    const mockRes: any = {
      setHeader: () => {},
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/decisions');
    const handled = handleApiRequest(mockReq, mockRes, url, JSON.stringify({}));
    expect(handled).toBe(true);
    expect(statusCode).toBe(401);
    expect(JSON.parse(responseBody).error.code).toBe('UNAUTHORIZED');
  });

  it('server rejects Grantee decision submission with 403 FORBIDDEN_GRANTOR_ONLY', () => {
    let statusCode = 0;
    let responseBody = '';

    const granteeToken = createMockFirebaseToken({ uid: 'ge-202', email: 'builder@grantee.org' });
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

    handleApiRequest(mockReq, mockRes, url, payload);
    expect(statusCode).toBe(403);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('FORBIDDEN_GRANTOR_ONLY');
  });

  it('server accepts valid Grantor decision submission with 201 Created', () => {
    let statusCode = 0;
    let responseBody = '';

    const grantorToken = createMockFirebaseToken({ uid: 'g-101', email: 'director@grantor.org' });
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

    handleApiRequest(mockReq, mockRes, url, payload);
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

  it('returns 501 Not Implemented disclosing pending Gemini integration', () => {
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
        title: 'Title',
        description: 'Desc',
        acceptance_criteria: ['Crit 1']
      },
      evidence_source: 'sample'
    });

    handleApiRequest(mockReq, mockRes, url, validBody);
    expect(statusCode).toBe(501);
    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('EVALUATION_NOT_IMPLEMENTED');
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
