import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('VeriCommit Public Landing Page & Entry Point (Phase 2B-1)', () => {
  const landingPath = path.resolve(__dirname, '../components/public/PublicLandingPage.tsx');
  const landingSource = fs.readFileSync(landingPath, 'utf-8');

  const appPath = path.resolve(__dirname, '../App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  describe('1. Brand & Core Value Proposition Copy', () => {
    it('contains VeriCommit product branding and tagline', () => {
      expect(landingSource).toContain('VeriCommit');
      expect(landingSource).toContain('Fund with Evidence');
      expect(landingSource).toContain('/images/vericommit-v-check-logo.png');
      expect(landingSource).toContain('v1.0');
    });

    it('contains the approved headline and supporting copy (Phase 2B-3A)', () => {
      expect(landingSource).toContain('fy What Software Grantees,');
      expect(landingSource).toContain('to Deliver.');
      expect(landingSource).toMatch(/<span[^>]*>Veri<\/span>fy What Software Grantees,\s*<span[^>]*>Commit<\/span> to Deliver\./);
      expect(landingSource).toContain(
        'VeriCommit helps grantors assess software grantees’ progress against agreed commitments using observable GitHub evidence, grounded AI assistance, and an auditable review process that supports accountable human decisions.'
      );
    });

    it('explains the 3 core pillars: Agree Criteria, Observable Evidence, Accountable Human Decisions', () => {
      expect(landingSource).toContain('1. Agree Criteria in Advance');
      expect(landingSource).toContain('2. Inspect Observable Evidence');
      expect(landingSource).toContain('3. Accountable Human Decisions');
    });
  });

  describe('2. Primary and Secondary Call-to-Action (CTA) Controls', () => {
    it('provides accessible primary CTA "Try VeriCommit"', () => {
      expect(landingSource).toContain('Try VeriCommit');
      expect(landingSource).toContain('data-testid="header-try-btn"');
      expect(landingSource).toContain('data-testid="hero-try-btn"');
      expect(landingSource).toContain('data-testid="bottom-try-btn"');
      expect(landingSource).toContain('aria-label="Try VeriCommit"');
      expect(landingSource).toContain('onTryVeriCommit');
    });

    it('provides accessible secondary CTA "Sign In with Google"', () => {
      expect(landingSource).toContain('Sign In');
      expect(landingSource).toContain('data-testid="header-signin-btn"');
      expect(landingSource).toContain('data-testid="hero-signin-btn"');
      expect(landingSource).toContain('data-testid="bottom-signin-btn"');
      expect(landingSource).toContain('aria-label="Sign In"');
      expect(landingSource).toContain('onSignIn');
    });

    it('enforces accessible 44px minimum touch targets on all interactive buttons', () => {
      const buttonMatches = landingSource.match(/<button[\s\S]*?<\/button>/g) || [];
      expect(buttonMatches.length).toBeGreaterThanOrEqual(4);
      for (const btn of buttonMatches) {
        expect(btn).toContain('min-h-[44px]');
      }
    });
  });

  describe('3. Honest Limitations & Ethical Governance Disclosures', () => {
    it('discloses that AI evaluations are strictly advisory with human_review_required', () => {
      expect(landingSource).toContain('AI Assessments Are Strictly Advisory');
      expect(landingSource).toContain('human_review_required: true');
      expect(landingSource).toContain('never approves milestones, releases funding');
    });

    it('discloses that formal decision authority remains exclusively with human Grantors', () => {
      expect(landingSource).toContain('Formal Decision Authority Stays with Humans');
      expect(landingSource).toContain('The responsible Grantor retains exclusive milestone approval authority');
      expect(landingSource).toContain('minimum 10 characters');
    });

    it('discloses that commit volume does not equal software quality or completion', () => {
      expect(landingSource).toContain('Commit Volume Does Not Equal Quality');
      expect(landingSource).toContain('does not treat commit counts or lines of code as proxies for developer productivity');
    });

    it('separates missing evidence from missing work', () => {
      expect(landingSource).toContain('Missing Evidence Is Not Proof of Non-Performance');
      expect(landingSource).toContain('insufficient_evidence');
      expect(landingSource).toContain('Missing repository artifacts are not treated as proof that work was not done');
    });

    it('does not make misleading claims of fraud prevention or guaranteed outcomes', () => {
      expect(landingSource).not.toContain('fraud prevention');
      expect(landingSource).not.toContain('guarantees project success');
      expect(landingSource).not.toContain('proves quality');
    });
  });

  describe('4. Feature Showcase Integration', () => {
    it('mounts FeatureCarousel inside PublicLandingPage to showcase capabilities', () => {
      expect(landingSource).toContain("import { FeatureCarousel } from '../FeatureCarousel';");
      expect(landingSource).toContain('<FeatureCarousel />');
    });
  });

  describe('5. App.tsx Root Integration & Public Isolation', () => {
    it('imports PublicLandingPage in App.tsx', () => {
      expect(appSource).toContain("import { PublicLandingPage } from './components/public/PublicLandingPage';");
    });

    it('renders PublicLandingPage when user is unauthenticated', () => {
      expect(appSource).toContain('if (!currentUser)');
      expect(appSource).toContain('<PublicLandingPage');
      expect(appSource).toContain('onSignIn={handleAuthAction}');
      expect(appSource).toContain('onTryVeriCommit={handleAuthAction}');
    });

    it('does not render private agreement details or decision controls in PublicLandingPage', () => {
      expect(landingSource).not.toContain('selectedAgreementId');
      expect(landingSource).not.toContain('initialFundingAgreements');
      expect(landingSource).not.toContain('handleSelectAgreement');
      expect(landingSource).not.toContain('decisionReasoning');
      expect(landingSource).not.toContain('isSubmittingDecision');
      expect(landingSource).not.toContain('id="agreement-selector"');
    });
  });
});
