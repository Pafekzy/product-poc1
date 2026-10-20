import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('VeriCommit Agreement Error Handling & Empty-State Distinction (Phase 2B-3A)', () => {
  const errorViewPath = path.resolve(__dirname, '../components/common/AgreementErrorView.tsx');
  const errorViewSource = fs.readFileSync(errorViewPath, 'utf-8');

  const emptyViewPath = path.resolve(__dirname, '../components/common/EmptyWorkspaceView.tsx');
  const emptyViewSource = fs.readFileSync(emptyViewPath, 'utf-8');

  const appPath = path.resolve(__dirname, '../App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  describe('1. AgreementErrorView Component Architecture & User Guidance', () => {
    it('contains VeriCommit official branding, logo asset, and version', () => {
      expect(errorViewSource).toContain('VeriCommit');
      expect(errorViewSource).toContain('/images/vericommit-v-check-logo.png');
      expect(errorViewSource).toContain('v1.0');
      expect(errorViewSource).toContain('Evidence-led milestone verification.');
    });

    it('clearly communicates that this is a request failure, not a zero-agreement confirmation', () => {
      expect(errorViewSource).toContain('Unable to Retrieve Funding Agreements');
      expect(errorViewSource).toContain('Agreement Request Error');
      expect(errorViewSource).toContain('This is a service request failure, not a confirmation of zero agreements.');
    });

    it('displays user email and diagnostic details container', () => {
      expect(errorViewSource).toContain('user?.displayName || user?.email');
      expect(errorViewSource).toContain('Diagnostic Details:');
      expect(errorViewSource).toContain('error ||');
    });

    it('provides accessible Retry button with loading state feedback and 44px min touch target', () => {
      expect(errorViewSource).toContain('data-testid="agreements-error-retry-btn"');
      expect(errorViewSource).toContain('aria-label="Retry Loading Agreements"');
      expect(errorViewSource).toContain('min-h-[44px]');
      expect(errorViewSource).toContain('Retrying verification...');
      expect(errorViewSource).toContain('Retry Verification');
    });

    it('provides accessible account switching and sign out controls', () => {
      expect(errorViewSource).toContain('data-testid="agreements-error-switch-account-btn"');
      expect(errorViewSource).toContain('data-testid="agreements-error-signout-btn"');
      expect(errorViewSource).toContain('Sign In with Different Account');
      expect(errorViewSource).toContain('min-h-[44px]');
    });

    it('discloses Fail-Closed Isolation Guarantee on request errors', () => {
      expect(errorViewSource).toContain('Fail-Closed Isolation Guarantee');
      expect(errorViewSource).toContain('Sample fixtures or unverified agreements are never substituted as fallbacks');
    });

    it('strictly isolates mock/sample agreement identifiers from error view', () => {
      expect(errorViewSource).not.toContain('fa-8041');
      expect(errorViewSource).not.toContain('fa-7342');
      expect(errorViewSource).not.toContain('fa-9210');
      expect(errorViewSource).not.toContain('initialFundingAgreements');
      expect(errorViewSource).not.toContain('sampleEvaluationReports');
    });
  });

  describe('2. App.tsx State Separation: Loading, Error, Empty, Populated', () => {
    it('declares agreementsError state in App.tsx', () => {
      expect(appSource).toContain('const [agreementsError, setAgreementsError] = useState<string | null>(null);');
    });

    it('imports AgreementErrorView and EmptyWorkspaceView in App.tsx', () => {
      expect(appSource).toContain("import { AgreementErrorView } from './components/common/AgreementErrorView';");
      expect(appSource).toContain("import { EmptyWorkspaceView } from './components/common/EmptyWorkspaceView';");
    });

    it('renders AgreementErrorView when agreementsError is present and availableAgreements is empty', () => {
      expect(appSource).toContain('if (agreementsError && availableAgreements.length === 0)');
      expect(appSource).toContain('<AgreementErrorView');
      expect(appSource).toContain('error={agreementsError}');
      expect(appSource).toContain('onRetry={() => loadAuthorizedAgreements(true)}');
    });

    it('renders EmptyWorkspaceView only when availableAgreements is 0 and no error occurred', () => {
      const errorRenderIndex = appSource.indexOf('if (agreementsError && availableAgreements.length === 0)');
      const emptyRenderIndex = appSource.indexOf('if (availableAgreements.length === 0)');
      expect(errorRenderIndex).toBeGreaterThan(-1);
      expect(emptyRenderIndex).toBeGreaterThan(-1);
      // Error check must occur before empty workspace check to prevent silent swallowing
      expect(errorRenderIndex).toBeLessThan(emptyRenderIndex);
    });

    it('captures network and service errors and records error message', () => {
      expect(appSource).toContain("setAgreementsError(err?.message || 'Failed to retrieve authorized agreements from server.');");
    });

    it('clears stale agreement selections and audit logs on error', () => {
      expect(appSource).toContain("setSelectedAgreementId('');");
      expect(appSource).toContain("activeAgreementIdRef.current = '';");
      expect(appSource).toContain('setSelectedMilestoneId(\'\');');
      expect(appSource).toContain('setEvaluations({});');
      expect(appSource).toContain('setAuditLogs([]);');
    });

    it('clears agreementsError when unauthenticated or when authorized agreements load successfully', () => {
      expect(appSource).toContain('setAgreementsError(null);');
    });
  });

  describe('3. Contrast between Empty State and Error State', () => {
    it('EmptyWorkspaceView does not claim an error occurred', () => {
      expect(emptyViewSource).toContain('No Active Funding Agreements');
      expect(emptyViewSource).not.toContain('Request Error');
      expect(emptyViewSource).not.toContain('Diagnostic Details:');
    });

    it('AgreementErrorView does not claim zero agreements were confirmed', () => {
      expect(errorViewSource).toContain('Unable to Retrieve Funding Agreements');
      expect(errorViewSource).not.toContain('No Active Funding Agreements');
      expect(errorViewSource).toContain('This is a service request failure, not a confirmation of zero agreements.');
    });
  });
});
