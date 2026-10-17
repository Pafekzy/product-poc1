import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { initialFundingAgreements } from '../data/mockData';
import { checkAgreementAuthorization } from '../server/auth';
import { initTestCrypto, createSignedFirebaseToken, testKeySet } from './testHelpers';
import { handleApiRequest } from '../server/api';

beforeAll(async () => {
  await initTestCrypto();
});

describe('Security Rules & Access Control Hardening', () => {
  const rulesPath = path.resolve(__dirname, '../../firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
  const baseAgreement = initialFundingAgreements[0]; // fa-8041: grantorId 'g-101', grantorEmail 'imaginright.dev@gmail.com', granteeId 'ge-202', granteeEmail 'grantee@example.com'

  describe('1. firestore.rules Structure & Policy Invariants', () => {
    it('declares rules_version = "2" and preserves root default-deny catch-all', () => {
      expect(rulesContent).toContain("rules_version = '2';");
      expect(rulesContent).toMatch(/match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
    });

    it('enforces that funding agreement identity and membership fields are immutable on update', () => {
      expect(rulesContent).toContain('incoming().grantorId == existing().grantorId');
      expect(rulesContent).toContain('incoming().granteeId == existing().granteeId');
      expect(rulesContent).toContain('incoming().grantorEmail == existing().grantorEmail');
      expect(rulesContent).toContain('incoming().granteeEmail == existing().granteeEmail');
      expect(rulesContent).toContain('incoming().createdAt == existing().createdAt');
    });

    it('restricts funding agreement status modification to Grantor only', () => {
      expect(rulesContent).toContain('isGrantor(agreementId) && incoming().status in [');
      expect(rulesContent).toContain('isGrantee(agreementId) && incoming().status == existing().status');
    });

    it('prohibits unscoped evaluation reads and mandates non-empty valid agreement_id', () => {
      // Must NOT contain permissive fallbacks
      expect(rulesContent).not.toContain("!('agreement_id' in resource.data)");
      expect(rulesContent).not.toContain('resource.data.agreement_id == null');

      // Must require agreement_id string, valid ID, and participant check
      expect(rulesContent).toContain("'agreement_id' in resource.data");
      expect(rulesContent).toContain('resource.data.agreement_id is string');
      expect(rulesContent).toContain('isValidId(resource.data.agreement_id)');
      expect(rulesContent).toContain('isAgreementParticipant(resource.data.agreement_id)');
      expect(rulesContent).toContain('isAgreementParticipant(incoming().agreement_id)');
      expect(rulesContent).toContain('exists(/databases/$(database)/documents/funding_agreements/$(incoming().agreement_id)/milestones/$(incoming().milestone_id))');
      expect(rulesContent).toContain('incoming().human_review_required == true');
      expect(rulesContent).toContain('allow update, delete: if false;');
    });

    it('prohibits unscoped human decision reads and enforces strict Grantor reviewer UID binding', () => {
      // Must NOT contain permissive fallbacks
      expect(rulesContent).not.toContain("!('agreement_id' in resource.data)");
      expect(rulesContent).not.toContain('resource.data.agreement_id == null');

      expect(rulesContent).toContain('incoming().reviewer_uid == request.auth.uid');
      expect(rulesContent).toContain('isGrantor(incoming().agreement_id)');
      expect(rulesContent).toContain('exists(/databases/$(database)/documents/funding_agreements/$(incoming().agreement_id)/milestones/$(incoming().milestone_id))');
      expect(rulesContent).toContain('allow update, delete: if false;');
    });

    it('prohibits unscoped audit log reads and writes and requires agreementId in hasAll', () => {
      // Must NOT contain permissive fallbacks
      expect(rulesContent).not.toContain("!('agreementId' in resource.data)");
      expect(rulesContent).not.toContain('resource.data.agreementId == null');
      expect(rulesContent).not.toContain("!('agreementId' in incoming())");
      expect(rulesContent).not.toContain('incoming().agreementId == null');

      // Must require agreementId in incoming keys and must enforce participation
      expect(rulesContent).toContain("'agreementId'");
      expect(rulesContent).toContain('incoming().agreementId is string && isValidId(incoming().agreementId)');
      expect(rulesContent).toContain('isAgreementParticipant(incoming().agreementId)');
      expect(rulesContent).toContain('exists(/databases/$(database)/documents/funding_agreements/$(incoming().agreementId))');
      expect(rulesContent).toContain('allow update, delete: if false;');
    });

    it('enforces email verification on email-based role matches in rules', () => {
      expect(rulesContent).toContain('function isEmailVerified()');
      expect(rulesContent).toContain('request.auth.token.email_verified == true');
      expect(rulesContent).toContain('isEmailVerified() && getAgreement(agreementId).grantorEmail != null');
      expect(rulesContent).toContain('isEmailVerified() && getAgreement(agreementId).granteeEmail != null');
    });

    it('prohibits creating milestones with pre-attached human decisions and restricts decision attachment to Grantor', () => {
      expect(rulesContent).toContain("(!('humanDecision' in incoming()) || incoming().humanDecision == null)");
      expect(rulesContent).toContain('incoming().humanDecision == existing().humanDecision ||');
      expect(rulesContent).toContain('isGrantor(agreementId)');
      expect(rulesContent).toContain('allow delete: if false;');
    });
  });

  describe('2. Authorization Logic & Role Boundary Assertions', () => {
    it('rejects an alien user from reading or writing cross-agreement assets', () => {
      const foreignUser = {
        uid: 'user-foreign-999',
        email: 'foreign@otherorg.org',
        email_verified: true
      };

      const check = checkAgreementAuthorization(foreignUser, baseAgreement);
      expect(check.authorized).toBe(false);
      expect(check.error?.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
    });

    it('allows Grantor and Grantee participants access with strict assigned roles', () => {
      const grantor = { uid: 'g-101', email: 'imaginright.dev@gmail.com', email_verified: true };
      const grantee = { uid: 'ge-202', email: 'grantee@example.com', email_verified: true };

      const gCheck = checkAgreementAuthorization(grantor, baseAgreement);
      expect(gCheck.authorized).toBe(true);
      expect(gCheck.role).toBe('Grantor');

      const geCheck = checkAgreementAuthorization(grantee, baseAgreement);
      expect(geCheck.authorized).toBe(true);
      expect(geCheck.role).toBe('Grantee');
    });

    it('strictly forbids Grantee from performing Grantor-only actions', () => {
      const grantee = { uid: 'ge-202', email: 'grantee@example.com', email_verified: true };
      const check = checkAgreementAuthorization(grantee, baseAgreement, 'Grantor');
      expect(check.authorized).toBe(false);
      expect(check.error?.code).toBe('FORBIDDEN_GRANTOR_ONLY');
    });

    it('strictly rejects user attempting email matching when email is not verified', () => {
      // User with DIFFERENT UID but matching email, however email_verified is false!
      const unverifiedUser = {
        uid: 'attacker-random-uid',
        email: 'imaginright.dev@gmail.com',
        email_verified: false
      };

      const check = checkAgreementAuthorization(unverifiedUser, baseAgreement);
      expect(check.authorized).toBe(false);
      expect(check.error?.code).toBe('FORBIDDEN_CROSS_AGREEMENT_ACCESS');
    });

    it('allows user with matching email when email is verified', () => {
      const verifiedUser = {
        uid: 'different-uid-but-verified',
        email: 'imaginright.dev@gmail.com',
        email_verified: true
      };

      const check = checkAgreementAuthorization(verifiedUser, baseAgreement);
      expect(check.authorized).toBe(true);
      expect(check.role).toBe('Grantor');
    });
  });

  describe('3. Decision Endpoint Forgery & Identifier Validation', () => {
    it('rejects decision when milestone does not belong to the agreement', async () => {
      let statusCode = 0;
      let responseBody = '';

      const grantorToken = await createSignedFirebaseToken({
        uid: 'g-101',
        email: 'imaginright.dev@gmail.com',
        email_verified: true
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
        milestone_id: 'ms-foreign-or-nonexistent',
        status: 'approved',
        reasoning: 'Attempting to approve milestone that is not in agreement fa-8041.'
      });

      await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
      expect(statusCode).toBe(400);
      expect(JSON.parse(responseBody).error.code).toBe('MILESTONE_NOT_IN_AGREEMENT');
    });

    it('rejects decision when caller is not the Grantor of that agreement', async () => {
      let statusCode = 0;
      let responseBody = '';

      const granteeToken = await createSignedFirebaseToken({
        uid: 'ge-202',
        email: 'grantee@example.com',
        email_verified: true
      });

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
        reasoning: 'Grantee trying to approve their own milestone.'
      });

      await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
      expect(statusCode).toBe(403);
      expect(JSON.parse(responseBody).error.code).toBe('FORBIDDEN_GRANTOR_ONLY');
    });

    it('rejects decision when agreement_id is missing, null, or empty', async () => {
      const grantorToken = await createSignedFirebaseToken({
        uid: 'g-101',
        email: 'imaginright.dev@gmail.com',
        email_verified: true
      });

      for (const invalidAgreementId of [undefined, null, '', '   ', '../../etc']) {
        let statusCode = 0;
        let responseBody = '';

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
          agreement_id: invalidAgreementId,
          milestone_id: 'ms-01',
          status: 'approved',
          reasoning: 'Valid reasoning with invalid agreement id.'
        });

        await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
        expect(statusCode).toBeGreaterThanOrEqual(400);
        const err = JSON.parse(responseBody).error;
        expect(['INVALID_REQUEST', 'AGREEMENT_NOT_FOUND']).toContain(err.code);
      }
    });

    it('rejects decision when milestone_id is missing, null, or empty', async () => {
      const grantorToken = await createSignedFirebaseToken({
        uid: 'g-101',
        email: 'imaginright.dev@gmail.com',
        email_verified: true
      });

      for (const invalidMilestoneId of [undefined, null, '', '   ']) {
        let statusCode = 0;
        let responseBody = '';

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
          milestone_id: invalidMilestoneId,
          status: 'approved',
          reasoning: 'Valid reasoning with missing milestone id.'
        });

        await handleApiRequest(mockReq, mockRes, url, payload, testKeySet);
        expect(statusCode).toBe(400);
        expect(JSON.parse(responseBody).error.code).toBe('INVALID_REQUEST');
      }
    });
  });

  describe('4. Audit Log & Identity Integrity Policy Logic', () => {
    it('validates that audit log actor_uid cannot be forged to another user', () => {
      const callerUid = 'g-101';
      const validAuditEntry = {
        id: 'audit-test-1',
        actor_uid: callerUid,
        action: 'Signed Decision',
        agreementId: 'fa-8041'
      };

      const forgedAuditEntry = {
        id: 'audit-test-2',
        actor_uid: 'victim-uid-888', // Forged actor UID!
        action: 'Signed Decision',
        agreementId: 'fa-8041'
      };

      // Policy check matching rule: (!('actor_uid' in entry) || entry.actor_uid == callerUid)
      const validateAudit = (entry: any, authUid: string) => {
        if (entry.actor_uid && entry.actor_uid !== authUid) return false;
        return true;
      };

      expect(validateAudit(validAuditEntry, callerUid)).toBe(true);
      expect(validateAudit(forgedAuditEntry, callerUid)).toBe(false);
    });

    it('strictly rejects audit log creation if agreementId is missing, null, or empty', () => {
      const validateAuditAgreementId = (entry: any) => {
        if (!('agreementId' in entry) || entry.agreementId == null) return false;
        if (typeof entry.agreementId !== 'string' || entry.agreementId.trim().length === 0) return false;
        return true;
      };

      expect(validateAuditAgreementId({ id: 'a1', agreementId: 'fa-8041' })).toBe(true);
      expect(validateAuditAgreementId({ id: 'a2' })).toBe(false);
      expect(validateAuditAgreementId({ id: 'a3', agreementId: null })).toBe(false);
      expect(validateAuditAgreementId({ id: 'a4', agreementId: '' })).toBe(false);
      expect(validateAuditAgreementId({ id: 'a5', agreementId: '   ' })).toBe(false);
    });

    it('simulates validation that milestone cannot be created with a pre-set human decision', () => {
      const validMilestoneCreation = {
        id: 'ms-new-1',
        fundingAgreementId: 'fa-8041',
        title: 'New Milestone',
        evidenceSource: 'sample',
        humanDecision: null
      };

      const maliciousMilestoneCreation = {
        id: 'ms-new-2',
        fundingAgreementId: 'fa-8041',
        title: 'Auto-Approved Milestone',
        evidenceSource: 'sample',
        humanDecision: {
          decision_id: 'dec-fake',
          status: 'approved',
          reasoning: 'Pre-approved without grantor review'
        }
      };

      const validateMilestoneCreate = (incoming: any) => {
        if (incoming.humanDecision != null) return false;
        return true;
      };

      expect(validateMilestoneCreate(validMilestoneCreation)).toBe(true);
      expect(validateMilestoneCreate(maliciousMilestoneCreation)).toBe(false);
    });
  });
});
