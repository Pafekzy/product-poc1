import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { handleApiRequest } from '../server/api';
import { testKeySet, createSignedFirebaseToken } from './testHelpers';

describe('VeriCommit Honest Empty State & Mock-Data Isolation (Phase 2B-2)', () => {
  const emptyViewPath = path.resolve(__dirname, '../components/common/EmptyWorkspaceView.tsx');
  const emptyViewSource = fs.readFileSync(emptyViewPath, 'utf-8');

  const appPath = path.resolve(__dirname, '../App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  const agreementStorePath = path.resolve(__dirname, '../server/agreementStore.ts');
  const agreementStoreSource = fs.readFileSync(agreementStorePath, 'utf-8');

  describe('1. EmptyWorkspaceView Component Architecture & Copy', () => {
    it('contains VeriCommit official branding and logo asset', () => {
      expect(emptyViewSource).toContain('VeriCommit');
      expect(emptyViewSource).toContain('/images/vericommit-v-check-logo.png');
      expect(emptyViewSource).toContain('v1.0');
      expect(emptyViewSource).toContain('Evidence-led milestone verification.');
    });

    it('clearly communicates agreement-scoped authorization and empty state', () => {
      expect(emptyViewSource).toContain('No Active Funding Agreements');
      expect(emptyViewSource).toContain('Agreement-Scoped Authorization');
      expect(emptyViewSource).toContain('This account is not currently an authorized participant on any funding agreements');
    });

    it('displays the authenticated user email and identity dynamically', () => {
      expect(emptyViewSource).toContain('user?.displayName || user?.email');
      expect(emptyViewSource).toContain('You are signed in as');
    });

    it('provides accessible Refresh Agreements button with loading feedback', () => {
      expect(emptyViewSource).toContain('data-testid="empty-workspace-refresh-btn"');
      expect(emptyViewSource).toContain('aria-label="Refresh Agreements"');
      expect(emptyViewSource).toContain('min-h-[44px]');
      expect(emptyViewSource).toContain('Checking for agreements...');
      expect(emptyViewSource).toContain('Refresh Agreements');
    });

    it('provides accessible account switching and sign out controls', () => {
      expect(emptyViewSource).toContain('data-testid="empty-workspace-switch-account-btn"');
      expect(emptyViewSource).toContain('data-testid="empty-workspace-signout-btn"');
      expect(emptyViewSource).toContain('Sign In with Different Account');
      expect(emptyViewSource).toContain('Sign out');
      expect(emptyViewSource).toContain('min-h-[44px]');
    });

    it('provides educational guidance for both Grantees and Grantors without fake action buttons', () => {
      expect(emptyViewSource).toContain('For Grantees & Builders');
      expect(emptyViewSource).toContain('For Grantors & Reviewers');
      // Must not contain fake or un-wired creation/join buttons
      expect(emptyViewSource).not.toContain('Create New Agreement');
      expect(emptyViewSource).not.toContain('Join Agreement');
      expect(emptyViewSource).not.toContain('Apply for Grant');
    });

    it('discloses strict Data Isolation Guarantee', () => {
      expect(emptyViewSource).toContain('Data Isolation Guarantee');
      expect(emptyViewSource).toContain('VeriCommit enforces agreement-scoped access boundaries');
      expect(emptyViewSource).toContain('Private milestone deliverables, repository evidence, and formal decision records');
    });

    it('strictly isolates mock/sample agreement identifiers from the empty state', () => {
      expect(emptyViewSource).not.toContain('fa-8041');
      expect(emptyViewSource).not.toContain('fa-7342');
      expect(emptyViewSource).not.toContain('fa-9210');
      expect(emptyViewSource).not.toContain('initialFundingAgreements');
      expect(emptyViewSource).not.toContain('sampleEvaluationReports');
    });
  });

  describe('2. App.tsx Integration & Empty State Routing', () => {
    it('imports EmptyWorkspaceView in App.tsx', () => {
      expect(appSource).toContain("import { EmptyWorkspaceView } from './components/common/EmptyWorkspaceView';");
    });

    it('renders EmptyWorkspaceView when authenticated user has 0 available agreements', () => {
      expect(appSource).toContain('if (availableAgreements.length === 0)');
      expect(appSource).toContain('<EmptyWorkspaceView');
      expect(appSource).toContain('user={currentUser}');
      expect(appSource).toContain('onRefresh=');
      expect(appSource).toContain('onSignOut={handleAuthAction}');
    });

    it('renders loading indicator while verifying agreements for authenticated user', () => {
      expect(appSource).toContain('if (agreementsLoading && availableAgreements.length === 0)');
      expect(appSource).toContain('Verifying authorized funding agreements...');
    });

    it('clears selectedAgreementId, activeAgreementIdRef, evaluations, and auditLogs when 0 agreements are returned', () => {
      expect(appSource).toContain("setSelectedAgreementId('');");
      expect(appSource).toContain("activeAgreementIdRef.current = '';");
      expect(appSource).toContain('setEvaluations({});');
      expect(appSource).toContain('setAuditLogs([]);');
    });

    it('handles query failures by failing safe and not exposing mock data', () => {
      expect(appSource).toContain('setAvailableAgreements([]);');
    });

    it('guards userRole computation against null or empty agreement', () => {
      expect(appSource).toContain('if (!currentUser || !currentAgreement) return \'Observer\';');
    });

    it('guards Firestore subscriptions against empty selectedAgreementId', () => {
      expect(appSource).toContain('if (!dbConnected || !currentUser || !selectedAgreementId) return;');
    });
  });

  describe('3. Server-Side Mock-Data Isolation & Foreign User Handling', () => {
    it('returns empty agreements list with HTTP 200 for user with zero agreements', async () => {
      const strangerToken = await createSignedFirebaseToken({
        uid: 'unauthorized-user-000',
        email: 'unaffiliated.developer@example.com',
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
      expect(parsed.agreements).toEqual([]);
      expect(parsed.userId).toBe('unauthorized-user-000');
    });

    it('never exposes sample agreements to unauthorized authenticated users via /api/v1/agreements', async () => {
      const unknownToken = await createSignedFirebaseToken({
        uid: 'random-user-12345',
        email: 'random@somewhere.io',
        email_verified: true
      });

      let responseBody = '';
      const mockReq: any = {
        method: 'GET',
        headers: { authorization: `Bearer ${unknownToken}` }
      };
      const mockRes: any = {
        setHeader: () => {},
        set statusCode(_val: number) {},
        end: (data: string) => { responseBody = data; }
      };

      const url = new URL('http://localhost:3000/api/v1/agreements');
      await handleApiRequest(mockReq, mockRes, url, '', testKeySet);

      const parsed = JSON.parse(responseBody);
      const returnedIds = parsed.agreements.map((a: any) => a.id);
      expect(returnedIds).not.toContain('fa-8041');
      expect(returnedIds).not.toContain('fa-7342');
      expect(returnedIds).not.toContain('fa-9210');
    });

    it('agreementStore returns results directly upon live query execution', () => {
      expect(agreementStoreSource).toContain('// Return results directly (including empty array) when authoritative query succeeds');
      expect(agreementStoreSource).toContain('return results;');
    });
  });
});
