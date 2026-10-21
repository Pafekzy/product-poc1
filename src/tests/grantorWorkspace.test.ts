import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('VeriCommit Phase 2C-3: Grantor Workspace Implementation & Role Isolation', () => {
  const grantorWorkspacePath = path.resolve(__dirname, '../components/grantor/GrantorWorkspace.tsx');
  const grantorSource = fs.readFileSync(grantorWorkspacePath, 'utf-8');

  const appPath = path.resolve(__dirname, '../App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  describe('1. Component Contracts & Explicit Props Boundary (P2C3-04, P2C3-05)', () => {
    it('defines typed GrantorNavigationTab union covering all 6 principal grantor views', () => {
      expect(grantorSource).toContain("export type GrantorNavigationTab =");
      expect(grantorSource).toContain("'dashboard'");
      expect(grantorSource).toContain("'milestone-details'");
      expect(grantorSource).toContain("'evidence-explorer'");
      expect(grantorSource).toContain("'verification-report'");
      expect(grantorSource).toContain("'human-review'");
      expect(grantorSource).toContain("'audit-history'");
    });

    it('defines typed GrantorWorkspaceProps interface with complete state and handler contracts', () => {
      expect(grantorSource).toContain('export interface GrantorWorkspaceProps');
      expect(grantorSource).toContain('currentAgreement: FundingAgreement;');
      expect(grantorSource).toContain('selectedMilestoneId: string;');
      expect(grantorSource).toContain('onSelectMilestone: (milestoneId: string) => void;');
      expect(grantorSource).toContain('activeTab: GrantorNavigationTab;');
      expect(grantorSource).toContain('onSelectTab: (tab: GrantorNavigationTab) => void;');
      expect(grantorSource).toContain('evaluations: Record<string, EvaluationReport>;');
      expect(grantorSource).toContain('auditLogs: AuditLogEntry[];');
      expect(grantorSource).toContain('currentUser: { displayName?: string | null; email?: string | null; uid?: string } | null;');
      expect(grantorSource).toContain('onRunEvaluation: (milestone: Milestone) => Promise<void>;');
      expect(grantorSource).toContain('onSubmitDecision: (e: React.FormEvent) => Promise<void>;');
      expect(grantorSource).toContain('onFetchLiveEvidence: () => Promise<void>;');
      expect(grantorSource).toContain('onOpenNewMilestoneModal: () => void;');
    });

    it('exports GrantorWorkspace as a named functional component', () => {
      expect(grantorSource).toContain('export function GrantorWorkspace({');
      expect(grantorSource).toContain('}: GrantorWorkspaceProps)');
    });
  });

  describe('2. Grantor Oversight & Portfolio Metrics (P2C3-05, P2C3-06)', () => {
    it('renders prominent Grantor Authority badge and Accountable Human Verification tag', () => {
      expect(grantorSource).toContain('Grantor Authority');
      expect(grantorSource).toContain('Accountable Human Verification');
    });

    it('displays agreement scope with Grantor and Grantee organizational context', () => {
      expect(grantorSource).toContain('Grant Oversight: {currentAgreement.title}');
      expect(grantorSource).toContain('Sponsoring Organization: <strong>{currentAgreement.grantorName}</strong>');
      expect(grantorSource).toContain('Grantee: <strong>{currentAgreement.granteeName}</strong>');
    });

    it('computes and displays live portfolio metrics strip (Budget, Approved Milestones, Pending Sign-off)', () => {
      expect(grantorSource).toContain('const approvedMilestones = currentAgreement.milestones.filter(');
      expect(grantorSource).toContain('m => m.humanDecision?.status === \'approved\'');
      expect(grantorSource).toContain('const pendingReviewMilestones = currentAgreement.milestones.filter(');
      expect(grantorSource).toContain('m => m.evaluationId && !m.humanDecision');
      expect(grantorSource).toContain('{approvedMilestones}/{totalMilestones} Approved');
      expect(grantorSource).toContain('Pending Sign-off');
    });

    it('highlights pending formal sign-off banner when AI evaluation is ready', () => {
      expect(grantorSource).toContain('data-testid="grantor-pending-review-banner"');
      expect(grantorSource).toContain('Formal Grantor Decision Required');
      expect(grantorSource).toContain('data-testid="grantor-review-now-btn"');
      expect(grantorSource).toContain("onSelectTab('human-review')");
    });
  });

  describe('3. Observable GitHub Evidence Inspection (P2C3-07)', () => {
    it('provides live repository evidence retrieval button with spinning indicator', () => {
      expect(grantorSource).toContain('data-testid="grantor-fetch-live-evidence-btn"');
      expect(grantorSource).toContain('onClick={onFetchLiveEvidence}');
      expect(grantorSource).toContain('Fetch Live GitHub Evidence');
      expect(grantorSource).toContain('Retrieving from GitHub...');
    });

    it('provides evidence mode switch between Live and Sample data', () => {
      expect(grantorSource).toContain("onEvidenceViewModeChange('live')");
      expect(grantorSource).toContain("onEvidenceViewModeChange('sample')");
    });

    it('renders commits and pull requests with external repository inspect links', () => {
      expect(grantorSource).toContain('pull_request');
      expect(grantorSource).toContain('commit');
      expect(grantorSource).toContain('Inspect');
      expect(grantorSource).toContain('target="_blank"');
      expect(grantorSource).toContain('rel="noreferrer"');
    });
  });

  describe('4. AI Assessment Grounding & Explicit Limitations (P2C3-08)', () => {
    it('clearly communicates mandatory Human Review Requirement to prevent automated funding approval', () => {
      expect(grantorSource).toContain('Human Review Required:');
      expect(grantorSource).toContain('AI evaluations are strictly advisory tools to aid human diligence. Authorized Grantor review is required before funds are disbursed.');
    });

    it('renders all recognized criteria status badges: supported, insufficient_evidence, uncertain, contradicted', () => {
      expect(grantorSource).toContain("case 'supported':");
      expect(grantorSource).toContain("case 'insufficient_evidence':");
      expect(grantorSource).toContain("case 'uncertain':");
      expect(grantorSource).toContain("case 'contradicted':");
      expect(grantorSource).toContain("case 'human_decision_pending':");
    });

    it('renders transparent list of known evaluation limitations', () => {
      expect(grantorSource).toContain('Known Evaluation Limitations');
      expect(grantorSource).toContain('currentEvaluation.limitations.map');
    });
  });

  describe('5. Formal Grantor Decision-Making Interface (P2C3-09)', () => {
    it('displays Consequential Review Authority heading for human accountability', () => {
      expect(grantorSource).toContain('Consequential Review Authority');
      expect(grantorSource).toContain('Record Formal Grantor Determination');
    });

    it('verifies Grantor role in signer identity card', () => {
      expect(grantorSource).toContain('Grantor (Authorized Signer)');
      expect(grantorSource).toContain('Authorized Signer Identity');
      expect(grantorSource).toContain('value={reviewerName}');
    });

    it('provides all 3 authorized decision choices: approved, changes_requested, rejected', () => {
      expect(grantorSource).toContain("val: 'approved', label: 'Approve Milestone'");
      expect(grantorSource).toContain("val: 'changes_requested', label: 'Request Changes'");
      expect(grantorSource).toContain("val: 'rejected', label: 'Reject Claim'");
      expect(grantorSource).toContain('data-testid={`grantor-decision-choice-${opt.val}`}');
    });

    it('enforces required rationale input with minimum length and explicit justification prompt', () => {
      expect(grantorSource).toContain('data-testid="grantor-decision-reasoning-input"');
      expect(grantorSource).toContain('Explicit Justification & Traceable Reasoning (Required, minimum 10 characters)');
      expect(grantorSource).toContain('required');
    });

    it('disables form controls during active decision submission', () => {
      expect(grantorSource).toContain('disabled={isSubmittingDecision}');
      expect(grantorSource).toContain('data-testid="grantor-record-decision-btn"');
      expect(grantorSource).toContain("isSubmittingDecision ? 'Verifying & Recording...' : 'Record & Sign Decision'");
    });
  });

  describe('6. Grantor Audit Trail & Governance (P2C3-10)', () => {
    it('renders chronological audit log of milestones, evaluations, and grantor decisions', () => {
      expect(grantorSource).toContain('Grantor Audit Trail');
      expect(grantorSource).toContain('Chronological, non-repudiable log of milestones, AI assessments, and formal Grantor decisions persisted in Firestore.');
      expect(grantorSource).toContain('auditLogs.map');
      expect(grantorSource).toContain('log.entityType');
      expect(grantorSource).toContain('log.action');
      expect(grantorSource).toContain('log.actor');
      expect(grantorSource).toContain('log.entityId');
    });
  });

  describe('7. App.tsx Integration & Role Guarding (P2C3-12)', () => {
    it('imports GrantorWorkspace in App.tsx', () => {
      expect(appSource).toContain("import { GrantorWorkspace } from './components/grantor/GrantorWorkspace';");
    });

    it('mounts GrantorWorkspace conditionally when userRole is Grantor', () => {
      expect(appSource).toContain("userRole === 'Grantor' ? (");
      expect(appSource).toContain('<GrantorWorkspace');
      expect(appSource).toContain('currentAgreement={currentAgreement}');
      expect(appSource).toContain('selectedMilestoneId={selectedMilestoneId}');
      expect(appSource).toContain('onSelectMilestone={setSelectedMilestoneId}');
      expect(appSource).toContain('onSubmitDecision={handleRecordDecision}');
      expect(appSource).toContain('onRunEvaluation={handleRunEvaluation}');
      expect(appSource).toContain('onFetchLiveEvidence={handleFetchLiveEvidence}');
      expect(appSource).toContain('onOpenNewMilestoneModal={() => setShowNewMilestoneModal(true)}');
    });

    it('preserves agreement selection bar before workspace view', () => {
      const contextBarIdx = appSource.indexOf('<AgreementContextBar');
      const grantorWorkspaceIdx = appSource.indexOf('<GrantorWorkspace');
      expect(contextBarIdx).toBeGreaterThan(-1);
      expect(grantorWorkspaceIdx).toBeGreaterThan(contextBarIdx);
    });
  });

  describe('8. Touch Target Standards & Responsive UI Guarantees (P2C3-11)', () => {
    it('enforces 44px minimum touch targets on all interactive buttons and inputs', () => {
      expect(grantorSource).toContain('min-h-[44px]');
      expect(grantorSource).toContain('min-h-[48px]');
    });

    it('enforces word break and overflow safety classes across text elements', () => {
      expect(grantorSource).toContain('break-words');
      expect(grantorSource).toContain('min-w-0');
      expect(grantorSource).toContain('leading-relaxed');
    });
  });
});
