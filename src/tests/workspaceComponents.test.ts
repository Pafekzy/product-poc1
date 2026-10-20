import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('VeriCommit Workspace Component Architecture & Isolation (Phase 2C-2)', () => {
  const headerPath = path.resolve(__dirname, '../components/workspace/WorkspaceHeader.tsx');
  const headerSource = fs.readFileSync(headerPath, 'utf-8');

  const contextBarPath = path.resolve(__dirname, '../components/workspace/AgreementContextBar.tsx');
  const contextBarSource = fs.readFileSync(contextBarPath, 'utf-8');

  const appPath = path.resolve(__dirname, '../App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  describe('1. WorkspaceHeader Component Contracts & Branding', () => {
    it('defines typed WorkspaceHeaderProps interface with explicit values', () => {
      expect(headerSource).toContain('export interface WorkspaceHeaderProps');
      expect(headerSource).toContain('user: User | null;');
      expect(headerSource).toContain('onSignOut: () => void;');
      expect(headerSource).toContain('dbConnected?: boolean;');
      expect(headerSource).toContain('authLoading?: boolean;');
      expect(headerSource).toContain('children?: React.ReactNode;');
    });

    it('renders VeriCommit branding, version badge, and official logo asset', () => {
      expect(headerSource).toContain('VeriCommit');
      expect(headerSource).toContain('v1.0');
      expect(headerSource).toContain('/images/vericommit-v-check-logo.png');
      expect(headerSource).toContain('Evidence-led milestone verification.');
    });

    it('renders persistence status indicator for Cloud Firestore connection', () => {
      expect(headerSource).toContain('Firestore: {dbConnected ? \'Connected\' : \'Connecting...\'}');
      expect(headerSource).toContain('Database');
    });

    it('displays authenticated user identity dynamically and provides sign-out action', () => {
      expect(headerSource).toContain('user.displayName || user.email');
      expect(headerSource).toContain('data-testid="workspace-header-signout-btn"');
      expect(headerSource).toContain('onClick={onSignOut}');
      expect(headerSource).toContain('Sign out');
    });

    it('provides accessible sign-in fallback when user is unauthenticated', () => {
      expect(headerSource).toContain('data-testid="workspace-header-signin-btn"');
      expect(headerSource).toContain('Sign in with Google');
      expect(headerSource).toContain('disabled={authLoading}');
    });

    it('preserves responsive fixed navbar styling and mobile touch target standards', () => {
      expect(headerSource).toContain('fixed top-0 left-0 right-0 z-40');
      expect(headerSource).toContain('bg-[#142C3E]');
      expect(headerSource).toContain('px-2.5 sm:px-6 lg:px-8 h-16');
      expect(headerSource).toContain('min-h-[36px]');
    });
  });

  describe('2. AgreementContextBar Component Contracts & Role Governance', () => {
    it('defines typed AgreementContextBarProps interface without role override controls', () => {
      expect(contextBarSource).toContain('export interface AgreementContextBarProps');
      expect(contextBarSource).toContain('agreements: FundingAgreement[];');
      expect(contextBarSource).toContain('selectedAgreementId: string;');
      expect(contextBarSource).toContain('onSelectAgreement: (agreementId: string) => void;');
      expect(contextBarSource).toContain('userRole: \'Grantor\' | \'Grantee\' | \'Observer\';');
      expect(contextBarSource).toContain('isAuthenticated?: boolean;');
      expect(contextBarSource).toContain('isLoading?: boolean;');
    });

    it('mounts BrandedDropdown for agreement selection passing formatted options and handler', () => {
      expect(contextBarSource).toContain('<BrandedDropdown');
      expect(contextBarSource).toContain('id="agreement-selector"');
      expect(contextBarSource).toContain('dataTestId="agreement-selector"');
      expect(contextBarSource).toContain('value={selectedAgreementId}');
      expect(contextBarSource).toContain('onChange={onSelectAgreement}');
      expect(contextBarSource).toContain('disabled={isLoading}');
      expect(contextBarSource).toContain('options={agreements.map');
    });

    it('displays verified role badge matching the computed agreement-scoped authorization', () => {
      expect(contextBarSource).toContain('data-testid="workspace-role-badge"');
      expect(contextBarSource).toContain('Role: {userRole === \'Grantor\' ? \'Grantor (Authorized Signer)\' : userRole === \'Grantee\' ? \'Grantee (Recipient)\' : \'Observer\'}');
      expect(contextBarSource).toContain('UserCheck');
    });

    it('displays authentication mode indicator (Authenticated Scope vs Demo Mode)', () => {
      expect(contextBarSource).toContain('data-testid="workspace-mode-indicator"');
      expect(contextBarSource).toContain('{isAuthenticated ? \'Authenticated Scope\' : \'Demo Mode (Sample)\'}');
    });

    it('does NOT expose a client-side role picker dropdown or allow users to mutate authority', () => {
      // Must not contain any select/picker for role manipulation
      expect(contextBarSource).not.toContain('onRoleChange');
      expect(contextBarSource).not.toContain('setUserRole');
      expect(contextBarSource).not.toContain('role-selector');
    });
  });

  describe('3. App.tsx Integration & Architectural Decoupling', () => {
    it('imports and mounts WorkspaceHeader in App.tsx', () => {
      expect(appSource).toContain('import { WorkspaceHeader } from \'./components/workspace/WorkspaceHeader\';');
      expect(appSource).toContain('<WorkspaceHeader');
      expect(appSource).toContain('user={currentUser}');
      expect(appSource).toContain('onSignOut={handleAuthAction}');
      expect(appSource).toContain('dbConnected={dbConnected}');
    });

    it('imports and mounts AgreementContextBar in App.tsx passing state and handlers', () => {
      expect(appSource).toContain('import { AgreementContextBar } from \'./components/workspace/AgreementContextBar\';');
      expect(appSource).toContain('<AgreementContextBar');
      expect(appSource).toContain('agreements={availableAgreements}');
      expect(appSource).toContain('selectedAgreementId={selectedAgreementId}');
      expect(appSource).toContain('onSelectAgreement={handleSelectAgreement}');
      expect(appSource).toContain('userRole={userRole}');
      expect(appSource).toContain('isAuthenticated={Boolean(currentUser)}');
      expect(appSource).toContain('isLoading={agreementsLoading}');
    });

    it('preserves synchronous activeAgreementIdRef update and state clearing on agreement change', () => {
      expect(appSource).toContain('activeAgreementIdRef.current = newAgreementId;');
      expect(appSource).toContain('setSelectedAgreementId(newAgreementId);');
      expect(appSource).toContain('setCurrentAgreement(target);');
      expect(appSource).toContain('setDecisionFeedback(null);');
      expect(appSource).toContain('setDecisionReasoning(\'\');');
      expect(appSource).toContain('setEvalNotice(null);');
      expect(appSource).toContain('setEvidenceNotice(null);');
      expect(appSource).toContain('setLiveEvidence(null);');
    });

    it('preserves root orchestration order: AuthLoading -> Public -> Error -> Empty -> Populated Workspace', () => {
      const authLoadingIndex = appSource.indexOf('if (authLoading)');
      const publicLandingIndex = appSource.indexOf('<PublicLandingPage', authLoadingIndex);
      const errorViewIndex = appSource.indexOf('<AgreementErrorView', publicLandingIndex);
      const emptyViewIndex = appSource.indexOf('<EmptyWorkspaceView', errorViewIndex);
      const populatedIndex = appSource.indexOf('<WorkspaceHeader', emptyViewIndex);

      expect(authLoadingIndex).toBeGreaterThan(-1);
      expect(publicLandingIndex).toBeGreaterThan(authLoadingIndex);
      expect(errorViewIndex).toBeGreaterThan(publicLandingIndex);
      expect(emptyViewIndex).toBeGreaterThan(errorViewIndex);
      expect(populatedIndex).toBeGreaterThan(emptyViewIndex);
    });
  });
});
