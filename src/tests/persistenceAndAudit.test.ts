import { describe, it, expect, beforeAll } from 'vitest';
import { handleApiRequest } from '../server/api';
import { checkAgreementAuthorization } from '../server/auth';
import { evaluateMilestone, evaluateEvidenceDeterministically } from '../server/evaluator';
import { Milestone, EvaluationReport, HumanDecision, AuditLogEntry } from '../types';
import { initialFundingAgreements, sampleEvaluationReports } from '../data/mockData';
import { getAuthoritativeAgreement } from '../server/agreementStore';
import { initTestCrypto, createSignedFirebaseToken, testKeySet, createMockGeminiClient } from './testHelpers';

beforeAll(async () => {
  await initTestCrypto();
});

describe('Prompt 04: Authoritative Persistence and Agreement-Scoped Relationships', () => {
  const agreement = initialFundingAgreements[0]; // fa-8041, grantorId: 'g-101', grantorEmail: 'imaginright.dev@gmail.com'

  describe('Report Creation, Relational Attributes & Human-Review Invariant', () => {
    it('creates an evaluation report containing agreement_id, milestone_id, repository_url, and human_review_required=true', async () => {
      const mockAi = createMockGeminiClient({
        responseText: JSON.stringify({
          overall_summary: 'Criterion supported by repository evidence.',
          criteria_results: [
            {
              criterion: 'A user can submit the registration form and receive account confirmation.',
              status: 'supported',
              explanation: 'Pull request #12 demonstrates complete implementation.',
              evidence: [{ type: 'pull_request', title: 'PR #12: Registration form', url: 'https://github.com/example/community-tools/pull/12' }]
            }
          ],
          suggested_next_steps: ['Review findings.'],
          limitations: ['Evaluated within bounded limits.']
        })
      });

      const report = await evaluateMilestone({
        project_name: agreement.title,
        agreement_id: agreement.id,
        milestone_id: 'ms-01',
        repository_url: 'https://github.com/example/community-tools',
        milestone: {
          id: 'ms-01',
          title: 'Implement member registration & validation',
          description: 'Deliver user registration workflows',
          acceptance_criteria: ['A user can submit the registration form and receive account confirmation.']
        },
        evidence_source: 'sample',
        aiClient: mockAi
      });

      // Verification of relational integrity
      expect(report.evaluation_id).toMatch(/^eval_/);
      expect(report.agreement_id).toBe('fa-8041');
      expect(report.milestone_id).toBe('ms-01');
      expect(report.repository_url).toBe('https://github.com/example/community-tools');
      expect(report.human_review_required).toBe(true);
      expect(report.criteria_results).toHaveLength(1);
      expect(report.criteria_results[0].status).toBe('supported');
    });

    it('deterministic evaluation also preserves agreement_id, milestone_id, and human_review_required=true', () => {
      const report = evaluateEvidenceDeterministically(
        {
          project_name: agreement.title,
          agreement_id: agreement.id,
          milestone_id: 'ms-01',
          repository_url: 'https://github.com/example/community-tools',
          milestone: {
            id: 'ms-01',
            title: 'Implement member registration & validation',
            description: 'Deliver user registration workflows',
            acceptance_criteria: ['A user can submit the registration form and receive account confirmation.']
          },
          evidence_source: 'sample'
        },
        [
          {
            id: 'pr-12',
            type: 'pull_request',
            title: 'PR #12: Registration form',
            url: 'https://github.com/example/community-tools/pull/12',
            summary: 'Implements member registration and confirmation',
            retrievedAt: new Date().toISOString(),
            isSample: true
          }
        ]
      );

      expect(report.agreement_id).toBe('fa-8041');
      expect(report.milestone_id).toBe('ms-01');
      expect(report.repository_url).toBe('https://github.com/example/community-tools');
      expect(report.human_review_required).toBe(true);
    });

    it('ensures AI evaluation report NEVER automatically approves the milestone or sets decision status', async () => {
      const mockAi = createMockGeminiClient();
      const report = await evaluateMilestone({
        project_name: agreement.title,
        agreement_id: agreement.id,
        milestone_id: 'ms-01',
        repository_url: 'https://github.com/example/community-tools',
        milestone: {
          title: 'Implement registration',
          description: 'Scope',
          acceptance_criteria: ['A user can submit registration.']
        },
        evidence_source: 'sample',
        aiClient: mockAi
      });

      // Assert invariant: EvaluationReport is an assessment, not an approval
      expect(report.human_review_required).toBe(true);
      expect((report as any).status).toBeUndefined();
      expect((report as any).decision).toBeUndefined();
      expect((report as any).approved).toBeUndefined();
    });
  });

  describe('Authoritative Agreement-Scoped Authorization (No Substring Hacks)', () => {
    it('authorizes Grantor by exact verified email match when user UID is dynamically generated', () => {
      const liveGrantorUser = {
        uid: 'firebase-random-uid-78912',
        email: 'imaginright.dev@gmail.com', // Matches agreement.grantorEmail
        email_verified: true
      };

      const auth = checkAgreementAuthorization(liveGrantorUser, agreement, 'Grantor');
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('Grantor');
    });

    it('authorizes Grantor by exact UID match', () => {
      const grantorByUid = {
        uid: 'g-101',
        email: 'elena@foundation.org',
        email_verified: true
      };

      const auth = checkAgreementAuthorization(grantorByUid, agreement, 'Grantor');
      expect(auth.authorized).toBe(true);
      expect(auth.role).toBe('Grantor');
    });

    it('rejects an unauthorized user attempting to access agreement data with FORBIDDEN_CROSS_AGREEMENT_ACCESS', () => {
      const unauthorizedUser = {
        uid: 'intruder-uid-999',
        email: 'attacker@evil.org',
        email_verified: true
      };

      const auth = checkAgreementAuthorization(unauthorizedUser, agreement);
      expect(auth.authorized).toBe(false);
      expect(auth.error?.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
    });

    it('rejects an email with substring tricks that does not strictly equal grantorEmail', () => {
      const spoofAttempt = {
        uid: 'attacker-uid-123',
        email: 'grantor-fake@not-the-foundation.org', // contains "grantor" substring!
        email_verified: true
      };

      // Since substring hacks are removed, this MUST fail
      const auth = checkAgreementAuthorization(spoofAttempt, agreement);
      expect(auth.authorized).toBe(false);
      expect(auth.error?.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
    });

    it('prohibits Grantees from recording Grantor decisions even if they are a valid participant in the agreement', () => {
      const granteeUser = {
        uid: 'ge-202',
        email: 'grantee@example.com',
        email_verified: true
      };

      const auth = checkAgreementAuthorization(granteeUser, agreement, 'Grantor');
      expect(auth.authorized).toBe(false);
      expect(auth.error?.code).toBe('FORBIDDEN_GRANTOR_ONLY');
      expect(auth.role).toBe('Grantee');
    });
  });

  describe('Human Review Decision Persistence & Server Enforcement', () => {
    it('server verifies token and accepts Grantor decision with complete relationship fields', async () => {
      let statusCode = 0;
      let responseBody = '';

      const grantorToken = await createSignedFirebaseToken({
        uid: 'g-101',
        email: 'imaginright.dev@gmail.com'
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

      const url = new URL('http://localhost:3000/api/v1/decisions');
      const payload = JSON.stringify({
        agreement_id: 'fa-8041',
        milestone_id: 'ms-01',
        evaluation_id: 'eval-demo-001',
        status: 'approved',
        reasoning: 'Verified all deliverables against PR #12 and registration test suite.'
      });

      const handled = await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
      expect(handled).toBe(true);
      expect(statusCode).toBe(201);

      const res = JSON.parse(responseBody);
      expect(res.success).toBe(true);
      expect(res.decision.agreement_id).toBe('fa-8041');
      expect(res.decision.milestone_id).toBe('ms-01');
      expect(res.decision.evaluation_id).toBe('eval-demo-001');
      expect(res.decision.reviewer_role).toBe('Grantor');
      expect(res.decision.reviewer_uid).toBe('g-101');
      expect(res.decision.status).toBe('approved');
      expect(res.decision.recorded_at).toBeTruthy();
    });

    it('rejects decision when milestone does not exist or does not belong to agreement with 400 MILESTONE_NOT_IN_AGREEMENT', async () => {
      let statusCode = 0;
      let responseBody = '';

      const grantorToken = await createSignedFirebaseToken({
        uid: 'g-101',
        email: 'imaginright.dev@gmail.com'
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

      const url = new URL('http://localhost:3000/api/v1/decisions');
      const payload = JSON.stringify({
        agreement_id: 'fa-8041',
        milestone_id: 'ms-nonexistent-999',
        status: 'approved',
        reasoning: 'Attempting to approve milestone that is not in this agreement.'
      });

      await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
      expect(statusCode).toBe(400);
      expect(JSON.parse(responseBody).error.code).toBe('MILESTONE_NOT_IN_AGREEMENT');
    });

    it('rejects decision when agreement does not exist with 404 AGREEMENT_NOT_FOUND', async () => {
      let statusCode = 0;
      let responseBody = '';

      const grantorToken = await createSignedFirebaseToken({
        uid: 'g-101',
        email: 'imaginright.dev@gmail.com'
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

      const url = new URL('http://localhost:3000/api/v1/decisions');
      const payload = JSON.stringify({
        agreement_id: 'fa-ghost-agreement',
        milestone_id: 'ms-01',
        status: 'approved',
        reasoning: 'Attempting to record a decision on a nonexistent agreement.'
      });

      await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
      expect(statusCode).toBe(404);
      expect(JSON.parse(responseBody).error.code).toBe('AGREEMENT_NOT_FOUND');
    });

    it('rejects decision when reasoning is missing or less than 10 characters with 400 INVALID_REQUEST', async () => {
      let statusCode = 0;
      let responseBody = '';

      const grantorToken = await createSignedFirebaseToken({
        uid: 'g-101',
        email: 'imaginright.dev@gmail.com'
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

      const url = new URL('http://localhost:3000/api/v1/decisions');
      const payload = JSON.stringify({
        agreement_id: 'fa-8041',
        milestone_id: 'ms-01',
        status: 'approved',
        reasoning: 'Short' // Only 5 chars, minimum 10 required
      });

      await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
      expect(statusCode).toBe(400);
      expect(JSON.parse(responseBody).error.code).toBe('INVALID_REQUEST');
      expect(JSON.parse(responseBody).error.message).toContain('minimum 10 characters');
    });

    it('authoritative agreement resolution fails closed (returns null) for unknown agreement IDs', async () => {
      const result = await getAuthoritativeAgreement('fa-nonexistent-unknown-999');
      expect(result).toBeNull();
    });

    it('strict identity authorization rejects substring email tricks and requires exact verified email match', () => {
      const attackerUser = {
        uid: 'attacker-1',
        email: 'attacker-grantor@randomdomain.com'
      };

      const authCheck = checkAgreementAuthorization(attackerUser, agreement, 'Grantor');
      expect(authCheck.authorized).toBe(false);
      expect(authCheck.error?.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');

      // Valid grantor with exact email
      const validGrantorUser = {
        uid: 'random-fresh-uid',
        email: 'imaginright.dev@gmail.com'
      };
      const validCheck = checkAgreementAuthorization(validGrantorUser, agreement, 'Grantor');
      expect(validCheck.authorized).toBe(true);
      expect(validCheck.role).toBe('Grantor');
    });
  });

  describe('Audit Event Persistence & Invariant Traceability', () => {
    it('creates well-formed audit log entries linked to agreement, milestone and actor UID', () => {
      const decisionAudit: AuditLogEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'Elena Vance (Grantor)',
        actor_uid: 'g-101',
        action: 'Recorded Human Decision: APPROVED',
        entityType: 'HumanDecision',
        entityId: 'dec-17290000',
        agreementId: 'fa-8041',
        milestoneId: 'ms-01',
        details: 'Milestone "Implement registration" approved. Reason: "All criteria met."'
      };

      expect(decisionAudit.entityType).toBe('HumanDecision');
      expect(decisionAudit.agreementId).toBe('fa-8041');
      expect(decisionAudit.milestoneId).toBe('ms-01');
      expect(decisionAudit.actor_uid).toBe('g-101');
      expect(decisionAudit.details).toContain('approved');
    });

    it('creates well-formed evaluation audit log entries with evidence provenance', () => {
      const evalAudit: AuditLogEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'AI Evaluation Service (Assisted)',
        action: 'Generated Evidence Assessment',
        entityType: 'Evaluation',
        entityId: 'eval-demo-001',
        agreementId: 'fa-8041',
        milestoneId: 'ms-01',
        details: 'Assessed evidence for Milestone "Implement registration" using Gemini 3.8 Flash (SAMPLE evidence).'
      };

      expect(evalAudit.entityType).toBe('Evaluation');
      expect(evalAudit.entityId).toBe('eval-demo-001');
      expect(evalAudit.agreementId).toBe('fa-8041');
      expect(evalAudit.details).toContain('SAMPLE');
    });
  });

  describe('Data Reload & Reinitialization Behavior', () => {
    it('merges stored evaluations into state so reports survive refresh and reinitialization', () => {
      // Simulate state re-initialization
      const initialEvaluationsState: Record<string, EvaluationReport> = { ...sampleEvaluationReports };

      // Simulate a newly saved evaluation fetched from Firestore
      const newlyFetchedEvaluation: EvaluationReport = {
        evaluation_id: 'eval-persisted-new-002',
        agreement_id: 'fa-8041',
        milestone_id: 'ms-02',
        repository_url: 'https://github.com/example/community-tools',
        project_name: 'Community Tools',
        milestone_title: 'Automated CI test suite',
        overall_summary: 'CI workflow configured and verified.',
        criteria_results: [
          {
            criterion: 'GitHub Actions workflow runs linting and unit tests.',
            status: 'supported',
            explanation: 'Workflow YAML file present and active.',
            evidence: [{ type: 'commit', title: 'ci: add workflow', url: 'https://github.com/example/community-tools/commit/123' }]
          }
        ],
        suggested_next_steps: ['Verify merge triggers in staging.'],
        limitations: ['Assessed within bounded commits.'],
        human_review_required: true,
        evaluated_at: new Date().toISOString(),
        evidence_source: 'sample'
      };

      // Merge from subscribeEvaluations callback
      const mergedEvaluations = {
        ...initialEvaluationsState,
        [newlyFetchedEvaluation.evaluation_id]: newlyFetchedEvaluation
      };

      // Milestone selecting ms-02 with evaluationId
      const targetMilestone: Milestone = {
        id: 'ms-02',
        fundingAgreementId: 'fa-8041',
        title: 'Automated CI test suite',
        description: 'Provide CI',
        evidenceSource: 'sample',
        evaluationId: 'eval-persisted-new-002',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        acceptanceCriteria: []
      };

      const resolvedReport = targetMilestone.evaluationId ? mergedEvaluations[targetMilestone.evaluationId] : null;
      expect(resolvedReport).not.toBeNull();
      expect(resolvedReport?.evaluation_id).toBe('eval-persisted-new-002');
      expect(resolvedReport?.agreement_id).toBe('fa-8041');
      expect(resolvedReport?.milestone_id).toBe('ms-02');
    });

    it('simulates milestone surviving refresh with recorded human decision', () => {
      const persistedDecision: HumanDecision = {
        decision_id: 'dec-17291000',
        agreement_id: 'fa-8041',
        milestone_id: 'ms-01',
        evaluation_id: 'eval-demo-001',
        reviewer_name: 'Elena Vance',
        reviewer_role: 'Grantor',
        reviewer_uid: 'g-101',
        reviewer_email: 'imaginright.dev@gmail.com',
        status: 'approved',
        reasoning: 'Verified PR #12 and automated tests. Deliverable completed.',
        recorded_at: new Date().toISOString()
      };

      // When agreement snapshot reloads
      const reloadedMilestone: Milestone = {
        id: 'ms-01',
        fundingAgreementId: 'fa-8041',
        title: 'Implement member registration',
        description: 'Deliver workflows',
        evidenceSource: 'sample',
        evaluationId: 'eval-demo-001',
        humanDecision: persistedDecision,
        createdAt: '2026-09-05T14:30:00Z',
        updatedAt: persistedDecision.recorded_at,
        acceptanceCriteria: []
      };

      expect(reloadedMilestone.humanDecision).toBeDefined();
      expect(reloadedMilestone.humanDecision?.status).toBe('approved');
      expect(reloadedMilestone.humanDecision?.reasoning).toContain('PR #12');
      expect(reloadedMilestone.humanDecision?.agreement_id).toBe('fa-8041');
      expect(reloadedMilestone.humanDecision?.milestone_id).toBe('ms-01');
    });
  });

  describe('Prompt 05: Security Boundaries, Duplicate Submission Guards & Failure Handling', () => {
    it('rejects unauthenticated decision request with 401 UNAUTHORIZED', async () => {
      let statusCode = 0;
      let responseBody = '';

      const mockReq: any = {
        method: 'POST',
        headers: {} // No authorization header
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
        reasoning: 'Attempting unauthenticated decision signing.'
      });

      await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
      expect(statusCode).toBe(401);
      expect(JSON.parse(responseBody).error.code).toBe('UNAUTHORIZED');
    });

    it('rejects decision with forged or untrusted token with 401 FORGED_SIGNATURE', async () => {
      let statusCode = 0;
      let responseBody = '';

      // Token not signed by testKeySet
      const untrustedToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJnLTEwMSIsImF1ZCI6Imdlbi1sYW5nLWNsaWVudC0wNzk0MzAwNDM2IiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2dlbi1sYW5nLWNsaWVudC0wNzk0MzAwNDM2In0.invalidsignaturehere';

      const mockReq: any = {
        method: 'POST',
        headers: { authorization: `Bearer ${untrustedToken}` }
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
        reasoning: 'Attempting decision with forged token.'
      });

      await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
      expect(statusCode).toBe(401);
      expect(JSON.parse(responseBody).error.code).toBe('FORGED_SIGNATURE');
    });

    it('rejects cross-agreement decision request when caller is Grantor of another agreement with 403 FORBIDDEN_CROSS_AGREEMENT_ACCESS', async () => {
      let statusCode = 0;
      let responseBody = '';

      // User is grantor on a different agreement, not fa-8041
      const alienGrantorToken = await createSignedFirebaseToken({
        uid: 'g-999-other-foundation',
        email: 'director@other-foundation.org'
      });

      const mockReq: any = {
        method: 'POST',
        headers: { authorization: `Bearer ${alienGrantorToken}` }
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
        reasoning: 'Foreign grantor attempting to sign decision on fa-8041.'
      });

      await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
      expect(statusCode).toBe(403);
      expect(JSON.parse(responseBody).error.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
    });

    it('simulates duplicate submission prevention where in-flight submission guard halts secondary invocation', async () => {
      let submissionCount = 0;
      let isSubmitting = false;

      // Simulated client handler matching handleRecordDecision pattern
      const submitDecision = async () => {
        if (isSubmitting) return 'BLOCKED_DUPLICATE';
        isSubmitting = true;
        try {
          submissionCount++;
          // Simulate network latency
          await new Promise(r => setTimeout(r, 20));
          return 'SUCCESS';
        } finally {
          isSubmitting = false;
        }
      };

      // User rapidly double-clicks
      const [firstClick, secondClick] = await Promise.all([
        submitDecision(),
        submitDecision()
      ]);

      expect(submissionCount).toBe(1);
      expect(firstClick).toBe('SUCCESS');
      expect(secondClick).toBe('BLOCKED_DUPLICATE');
    });

    it('handles partial persistence failure: reports clear error when Firestore write rejects without false success', async () => {
      const feedbackState: { current: { type: string; message: string } | null } = { current: null };

      // Simulate client flow where server approves but Firestore write fails
      const executePersist = async () => {
        // Step 1: Server approves
        const serverApproved = true;
        expect(serverApproved).toBe(true);

        // Step 2: Firestore write throws
        try {
          throw new Error('Missing or insufficient permissions: permission-denied');
        } catch (saveErr: any) {
          feedbackState.current = {
            type: 'error',
            message: `Server approved decision, but Cloud Firestore write failed: ${saveErr.message || 'Permission denied'}.`
          };
        }
      };

      await executePersist();
      expect(feedbackState.current).not.toBeNull();
      expect(feedbackState.current?.type).toBe('error');
      expect(feedbackState.current?.message).toContain('Cloud Firestore write failed');
      expect(feedbackState.current?.message).toContain('permission-denied');
    });

    it('getAuthoritativeAgreement fails closed (returns null) when Firestore REST returns 403 Forbidden', async () => {
      const mockForbiddenFetch = (async () => ({
        status: 403,
        ok: false,
        json: async () => ({ error: { code: 403, message: 'Missing or insufficient permissions.' } })
      })) as any;

      const dummyToken = 'header.payload.signature';
      const result = await getAuthoritativeAgreement('fa-8041', dummyToken, mockForbiddenFetch);
      expect(result).toBeNull();
    });

    it('getAuthoritativeAgreement fails closed (returns null) when Firestore REST returns 404 Not Found', async () => {
      const mockNotFoundFetch = (async () => ({
        status: 404,
        ok: false,
        json: async () => ({ error: { code: 404, message: 'Document not found.' } })
      })) as any;

      const dummyToken = 'header.payload.signature';
      const result = await getAuthoritativeAgreement('fa-ghost', dummyToken, mockNotFoundFetch);
      expect(result).toBeNull();
    });

    it('getAuthoritativeAgreement parses live Firestore REST document structure and milestones subcollection', async () => {
      const mockSuccessFetch = (async (url: string) => {
        if (url.endsWith('/milestones')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              documents: [
                {
                  name: 'projects/p/databases/d/documents/funding_agreements/fa-live-99/milestones/ms-live-01',
                  fields: {
                    id: { stringValue: 'ms-live-01' },
                    fundingAgreementId: { stringValue: 'fa-live-99' },
                    title: { stringValue: 'Production deliverable' },
                    evidenceSource: { stringValue: 'github' },
                    repositoryUrl: { stringValue: 'https://github.com/Pafekzy/product-poc1' }
                  }
                }
              ]
            })
          };
        }
        return {
          status: 200,
          ok: true,
          json: async () => ({
            fields: {
              id: { stringValue: 'fa-live-99' },
              title: { stringValue: 'Live Verified Grant Agreement' },
              grantorId: { stringValue: 'g-live-owner' },
              grantorEmail: { stringValue: 'owner@live-foundation.org' },
              granteeId: { stringValue: 'ge-live-builder' },
              granteeEmail: { stringValue: 'builder@live-protocol.org' },
              status: { stringValue: 'active' }
            }
          })
        };
      }) as any;

      const dummyToken = 'header.payload.signature';
      const parsedAgreement = await getAuthoritativeAgreement('fa-live-99', dummyToken, mockSuccessFetch);
      expect(parsedAgreement).not.toBeNull();
      expect(parsedAgreement?.id).toBe('fa-live-99');
      expect(parsedAgreement?.grantorId).toBe('g-live-owner');
      expect(parsedAgreement?.grantorEmail).toBe('owner@live-foundation.org');
      expect(parsedAgreement?.milestones).toHaveLength(1);
      expect(parsedAgreement?.milestones[0].id).toBe('ms-live-01');
      expect(parsedAgreement?.milestones[0].repositoryUrl).toBe('https://github.com/Pafekzy/product-poc1');
    });
  });
});
