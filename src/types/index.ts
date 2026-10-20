export type CriterionStatus = 
  | 'supported' 
  | 'insufficient_evidence' 
  | 'uncertain' 
  | 'contradicted' 
  | 'human_decision_pending';

export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export type MilestoneLifecycleState = 
  | 'draft' 
  | 'in_progress' 
  | 'submitted_for_review' 
  | 'approved' 
  | 'rejected' 
  | 'changes_requested';

export type EvaluationScope = 'formal' | 'self_assessment';

export type EvidenceType = 'pull_request' | 'commit' | 'release' | 'test_run' | 'document';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  url: string;
  summary?: string;
  retrievedAt: string;
  isSample: boolean;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  status: CriterionStatus;
  explanation?: string;
  associatedEvidenceIds?: string[];
}

export interface Milestone {
  id: string;
  fundingAgreementId: string;
  title: string;
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
  repositoryUrl?: string;
  evidenceSource: 'github' | 'sample';
  targetDate?: string;
  /**
   * Approved domain lifecycle state.
   * Optional in Phase 1B for backward compatibility with existing fixtures and Firestore documents
   * prior to Phase 3 lifecycle transition enforcement.
   */
  lifecycleState?: MilestoneLifecycleState;
  evaluationId?: string;
  humanDecision?: HumanDecision;
  createdAt: string;
  updatedAt: string;
}

export interface FundingAgreement {
  id: string;
  title: string;
  grantorId: string;
  grantorName: string;
  grantorEmail?: string;
  granteeId: string;
  granteeName: string;
  granteeEmail?: string;
  description: string;
  totalCommitment?: string;
  milestones: Milestone[];
  status: 'active' | 'completed' | 'terminated';
  createdAt: string;
}

export interface CriterionResult {
  criterion: string;
  status: CriterionStatus;
  explanation: string;
  evidence: Array<{
    type: EvidenceType;
    title: string;
    url: string;
  }>;
}

export interface EvaluationReport {
  evaluation_id: string;
  agreement_id?: string;
  milestone_id?: string;
  repository_url?: string;
  project_name: string;
  milestone_title: string;
  overall_summary: string;
  criteria_results: CriterionResult[];
  suggested_next_steps: string[];
  limitations: string[];
  human_review_required: boolean;
  evaluated_at: string;
  evidence_source: 'github' | 'sample';
  /**
   * Distinguishes formal Grantor milestone review from informal Grantee pre-submission self-assessment.
   * Optional in Phase 1B for backward compatibility with existing saved reports.
   */
  evaluationScope?: EvaluationScope;
}

export interface HumanDecision {
  decision_id: string;
  agreement_id: string;
  milestone_id: string;
  evaluation_id?: string;
  reviewer_name: string;
  reviewer_role: 'Grantor' | 'Reviewer';
  reviewer_uid?: string;
  reviewer_email?: string;
  status: 'approved' | 'rejected' | 'changes_requested';
  reasoning: string;
  recorded_at: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  actor_uid?: string;
  action: string;
  entityType: 'FundingAgreement' | 'Milestone' | 'Evaluation' | 'HumanDecision' | 'Evidence';
  entityId: string;
  details: string;
  agreementId?: string;
  milestoneId?: string;
  previousState?: string;
  newState?: string;
}

/**
 * PROPOSED DOMAIN TYPE — APPROVED DESIGN (NOT IMPLEMENTED IN RUNTIME)
 * Represents a single-use authorization token binding an invited Grantee
 * email to a specific Funding Agreement. Runtime endpoints and Firestore rules
 * are planned for a subsequent phase.
 */
export interface GranteeInvitation {
  id: string;
  agreementId: string;
  targetEmail: string;
  tokenHash: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  acceptedByUid?: string;
}
