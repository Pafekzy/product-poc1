import React from 'react';
import {
  FileCheck2,
  GitPullRequest,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  Play,
  Plus,
  RefreshCw,
  Loader2,
  Info,
  ExternalLink,
  GitCommit
} from 'lucide-react';
import { FeatureCarousel } from '../FeatureCarousel';
import type {
  FundingAgreement,
  Milestone,
  EvaluationReport,
  AuditLogEntry,
  CriterionStatus
} from '../../types';

export type GrantorNavigationTab =
  | 'dashboard'
  | 'milestone-details'
  | 'evidence-explorer'
  | 'verification-report'
  | 'human-review'
  | 'audit-history';

export interface GrantorWorkspaceProps {
  currentAgreement: FundingAgreement;
  selectedMilestoneId: string;
  onSelectMilestone: (milestoneId: string) => void;
  activeTab: GrantorNavigationTab;
  onSelectTab: (tab: GrantorNavigationTab) => void;
  evaluations: Record<string, EvaluationReport>;
  auditLogs: AuditLogEntry[];
  currentUser: { displayName?: string | null; email?: string | null; uid?: string } | null;
  // Evaluation handlers & state
  isEvaluating: boolean;
  evaluatingMilestoneId: string | null;
  evalStage: 'idle' | 'retrieving' | 'evaluating';
  evalNotice: { type: 'error' | 'success'; message: string } | null;
  onRunEvaluation: (milestone: Milestone) => Promise<void>;
  // Decision handlers & state
  reviewerName: string;
  onReviewerNameChange: (name: string) => void;
  decisionChoice: 'approved' | 'rejected' | 'changes_requested';
  onDecisionChoiceChange: (choice: 'approved' | 'rejected' | 'changes_requested') => void;
  decisionReasoning: string;
  onDecisionReasoningChange: (reasoning: string) => void;
  decisionFeedback: { type: 'error' | 'success'; message: string } | null;
  onDismissDecisionFeedback: () => void;
  isSubmittingDecision: boolean;
  onSubmitDecision: (e: React.FormEvent) => Promise<void>;
  // Evidence Explorer handlers & state
  evidenceViewMode: 'sample' | 'live';
  onEvidenceViewModeChange: (mode: 'sample' | 'live') => void;
  liveEvidence: any;
  isFetchingEvidence: boolean;
  onFetchLiveEvidence: () => Promise<void>;
  evidenceNotice: { type: 'error' | 'success' | 'info'; message: string } | null;
  // Milestone modal
  onOpenNewMilestoneModal: () => void;
}

export function GrantorWorkspace({
  currentAgreement,
  selectedMilestoneId,
  onSelectMilestone,
  activeTab,
  onSelectTab,
  evaluations,
  auditLogs,
  currentUser,
  isEvaluating,
  evaluatingMilestoneId,
  evalStage,
  evalNotice,
  onRunEvaluation,
  reviewerName,
  onReviewerNameChange,
  decisionChoice,
  onDecisionChoiceChange,
  decisionReasoning,
  onDecisionReasoningChange,
  decisionFeedback,
  onDismissDecisionFeedback,
  isSubmittingDecision,
  onSubmitDecision,
  evidenceViewMode,
  onEvidenceViewModeChange,
  liveEvidence,
  isFetchingEvidence,
  onFetchLiveEvidence,
  evidenceNotice,
  onOpenNewMilestoneModal
}: GrantorWorkspaceProps) {
  const currentMilestone =
    currentAgreement.milestones.find(m => m.id === selectedMilestoneId) ||
    currentAgreement.milestones[0];
  const currentEvaluation = currentMilestone?.evaluationId
    ? evaluations[currentMilestone.evaluationId]
    : null;

  // Compute Grantor oversight metrics
  const totalMilestones = currentAgreement.milestones.length;
  const approvedMilestones = currentAgreement.milestones.filter(
    m => m.humanDecision?.status === 'approved'
  ).length;
  const pendingReviewMilestones = currentAgreement.milestones.filter(
    m => m.evaluationId && !m.humanDecision
  ).length;

  const getStatusBadge = (status: CriterionStatus) => {
    switch (status) {
      case 'supported':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#E6F4F2] text-[#167D72] border border-[#A8DDD7] shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Supported
          </span>
        );
      case 'insufficient_evidence':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#F4F5F7] text-[#5B6673] border border-[#DCE3E9] shrink-0">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            Insufficient evidence
          </span>
        );
      case 'uncertain':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#FFF1D6] text-[#8C5E00] border border-[#F2D696] shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Uncertain
          </span>
        );
      case 'contradicted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4] shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Contradicted
          </span>
        );
      case 'human_decision_pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#EEF2F6] text-[#142C3E] border border-[#DCE3E9] shrink-0">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Human decision pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="grantor-workspace">
      {/* Grantor Oversight Context Banner */}
      <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase bg-[#142C3E] text-white px-2 py-0.5 rounded font-bold">
              Grantor Authority
            </span>
            <span className="text-xs font-semibold text-[#167D72]">
              Accountable Human Verification
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#142C3E]">
            Grant Oversight: {currentAgreement.title}
          </h2>
          <p className="text-xs text-[#5B6673]">
            Sponsoring Organization: <strong>{currentAgreement.grantorName}</strong> • Grantee: <strong>{currentAgreement.granteeName}</strong>
          </p>
        </div>

        {/* Grantor Metrics Strip */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="px-3 py-2 rounded-lg bg-[#F5F7F9] border border-[#DCE3E9] text-center min-w-[90px]">
            <div className="text-[10px] font-bold uppercase text-[#5B6673]">Budget</div>
            <div className="text-xs sm:text-sm font-mono font-bold text-[#142C3E]">
              {currentAgreement.totalCommitment || 'N/A'}
            </div>
          </div>
          <div className="px-3 py-2 rounded-lg bg-[#F5F7F9] border border-[#DCE3E9] text-center min-w-[90px]">
            <div className="text-[10px] font-bold uppercase text-[#5B6673]">Milestones</div>
            <div className="text-xs sm:text-sm font-bold text-[#142C3E]">
              {approvedMilestones}/{totalMilestones} Approved
            </div>
          </div>
          <div className={`px-3 py-2 rounded-lg border text-center min-w-[90px] ${
            pendingReviewMilestones > 0
              ? 'bg-[#FFF1D6] border-[#F2D696] text-[#8C5E00]'
              : 'bg-[#F5F7F9] border-[#DCE3E9] text-[#5B6673]'
          }`}>
            <div className="text-[10px] font-bold uppercase">Pending Sign-off</div>
            <div className="text-xs sm:text-sm font-bold">
              {pendingReviewMilestones}
            </div>
          </div>
        </div>
      </div>

      {/* Grantor Action Required Banner (Pending Formal Review) */}
      {activeTab !== 'human-review' && currentMilestone && !currentMilestone.humanDecision && currentMilestone.evaluationId && (
        <div
          className="p-3.5 sm:p-4 bg-[#FFF1D6] border border-[#F2D696] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
          data-testid="grantor-pending-review-banner"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <Info className="w-5 h-5 text-[#8C5E00] shrink-0 mt-0.5" />
            <div className="text-sm text-[#17212B] min-w-0">
              <div className="font-semibold text-[#8C5E00]">Formal Grantor Decision Required</div>
              <p className="text-xs text-[#5B6673] mt-0.5 break-words">
                AI evaluation is ready for <strong>{currentMilestone.title}</strong>. As authorized Grantor, your formal approval or change request is required to conclude this milestone.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('human-review')}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition shrink-0 min-h-[44px] text-center flex items-center justify-center cursor-pointer"
            data-testid="grantor-review-now-btn"
          >
            Record Formal Decision
          </button>
        </div>
      )}

      {/* In-Flight Evaluation Progress Banner */}
      {isEvaluating && (
        <div
          className="p-4 rounded-xl text-xs sm:text-sm shadow-xs bg-[#EAF2F8] border border-[#BBD5E8] text-[#142C3E] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          data-testid="evaluation-progress-banner"
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <Loader2 className="w-5 h-5 text-[#167D72] animate-spin shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-[#142C3E]">
                {evalStage === 'retrieving'
                  ? 'Retrieving repository evidence...'
                  : 'Gemini is evaluating milestone evidence against agreed criteria...'}
              </p>
              <p className="text-xs text-[#5B6673] mt-0.5">
                {evalStage === 'retrieving'
                  ? 'Fetching commits and pull requests from GitHub repository.'
                  : 'Running server-side Gemini 3.8 Flash model with grounded evidence constraints.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <span className="text-[11px] font-mono font-semibold text-[#167D72] uppercase px-2.5 py-1 bg-white rounded border border-[#BBD5E8]">
              {evalStage === 'retrieving' ? 'Stage 1/2: Retrieval' : 'Stage 2/2: Evaluation'}
            </span>
          </div>
        </div>
      )}

      {/* Prominent Evaluation Notice */}
      {evalNotice && activeTab !== 'verification-report' && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 border ${
            evalNotice.type === 'error'
              ? 'bg-[#FDF2F2] border-[#F8B4B4] text-[#9B1C1C]'
              : 'bg-[#E6F4F2] border-[#A8DDD7] text-[#167D72]'
          }`}
          data-testid="eval-notice-banner"
        >
          <span className="break-words font-medium">{evalNotice.message}</span>
        </div>
      )}

      {/* TAB 1: GRANT OVERSIGHT & PORTFOLIO */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4 sm:space-y-6">
          <FeatureCarousel />

          {/* Agreement Details Card */}
          <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono uppercase bg-[#EEF2F6] text-[#5B6673] px-2 py-0.5 rounded">
                    {currentAgreement.id.toUpperCase()}
                  </span>
                  <span className="text-xs text-[#167D72] font-semibold uppercase tracking-wider">
                    Authorized Agreement Oversight
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] mt-1.5 break-words">
                  {currentAgreement.title}
                </h1>
                <p className="text-xs sm:text-sm text-[#5B6673] mt-1 max-w-3xl leading-relaxed">
                  {currentAgreement.description}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 pt-1 md:pt-0">
                <button
                  onClick={onOpenNewMilestoneModal}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition shadow-xs min-h-[44px] cursor-pointer"
                  data-testid="grantor-define-milestone-btn"
                >
                  <Plus className="w-4 h-4" />
                  Define Milestone
                </button>
              </div>
            </div>

            <div className="mt-4 sm:mt-6 pt-4 border-t border-[#DCE3E9] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs">
              <div className="min-w-0">
                <span className="text-[#5B6673]">Grantor Entity</span>
                <div className="font-semibold text-[#17212B] mt-0.5 truncate">{currentAgreement.grantorName}</div>
              </div>
              <div className="min-w-0">
                <span className="text-[#5B6673]">Grantee Entity</span>
                <div className="font-semibold text-[#17212B] mt-0.5 truncate">{currentAgreement.granteeName}</div>
              </div>
              <div className="min-w-0">
                <span className="text-[#5B6673]">Total Commitment</span>
                <div className="font-semibold text-[#17212B] mt-0.5 font-mono">{currentAgreement.totalCommitment}</div>
              </div>
              <div className="min-w-0">
                <span className="text-[#5B6673]">Milestones in Scope</span>
                <div className="font-semibold text-[#17212B] mt-0.5">{currentAgreement.milestones.length} Defined</div>
              </div>
            </div>
          </div>

          {/* Agreed Milestones Oversight List */}
          <div className="bg-white rounded-xl border border-[#DCE3E9] overflow-hidden shadow-xs">
            <div className="px-4 sm:px-6 py-4 border-b border-[#DCE3E9] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#142C3E]">Milestone Portfolio Review</h2>
                <p className="text-xs text-[#5B6673]">Every milestone maps to pre-agreed acceptance criteria and verifiable repository artifacts.</p>
              </div>
            </div>

            <div className="divide-y divide-[#DCE3E9]">
              {currentAgreement.milestones.map((ms, idx) => {
                const isSelected = ms.id === currentMilestone.id;
                const hasEvaluation = Boolean(ms.evaluationId);
                const decision = ms.humanDecision;

                return (
                  <div
                    key={ms.id}
                    className={`p-4 sm:p-6 transition-colors ${isSelected ? 'bg-[#F9FBFC]' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold bg-[#142C3E] text-white px-2 py-0.5 rounded shrink-0">
                            Milestone {idx + 1}
                          </span>
                          <h3 className="text-sm sm:text-base font-semibold text-[#142C3E] break-words">{ms.title}</h3>
                          {decision ? (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${
                              decision.status === 'approved'
                                ? 'bg-[#E6F4F2] text-[#167D72]'
                                : decision.status === 'changes_requested'
                                ? 'bg-[#FFF1D6] text-[#8C5E00]'
                                : 'bg-[#FDE8E8] text-[#9B1C1C]'
                            }`}>
                              Decision: {decision.status.toUpperCase()}
                            </span>
                          ) : hasEvaluation ? (
                            <span className="text-xs px-2 py-0.5 rounded font-medium bg-[#FFF1D6] text-[#8C5E00] shrink-0">
                              Evaluation ready for formal decision
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded font-medium bg-[#EEF2F6] text-[#5B6673] shrink-0">
                              Ready for evaluation
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-[#5B6673] break-words leading-relaxed">{ms.description}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5B6673]">
                          <span><strong>Criteria:</strong> {ms.acceptanceCriteria?.length || 0}</span>
                          <span>•</span>
                          <span className="font-mono"><strong>Source:</strong> {ms.evidenceSource.toUpperCase()}</span>
                          <span>•</span>
                          <span className="font-mono break-all"><strong>Repo:</strong> {ms.repositoryUrl}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 shrink-0 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            onSelectMilestone(ms.id);
                            onSelectTab('milestone-details');
                          }}
                          className="flex-1 sm:flex-none px-3 py-2.5 text-xs font-medium text-[#142C3E] bg-[#EEF2F6] hover:bg-[#DCE3E9] rounded-lg transition min-h-[44px] flex items-center justify-center text-center cursor-pointer"
                        >
                          Inspect Criteria
                        </button>
                        {hasEvaluation ? (
                          <>
                            <button
                              onClick={() => {
                                onSelectMilestone(ms.id);
                                onSelectTab('verification-report');
                              }}
                              className="flex-1 sm:flex-none px-3 py-2.5 text-xs font-medium text-white bg-[#167D72] hover:bg-[#12645B] rounded-lg transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              View Report
                            </button>
                            <button
                              onClick={() => {
                                onSelectMilestone(ms.id);
                                onSelectTab('human-review');
                              }}
                              className="flex-1 sm:flex-none px-3 py-2.5 text-xs font-medium text-white bg-[#142C3E] hover:bg-[#1E3E56] rounded-lg transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                              data-testid={`grantor-decision-btn-${ms.id}`}
                            >
                              <UserCheck className="w-3.5 h-3.5 text-[#167D72]" />
                              {decision ? 'Update Decision' : 'Record Decision'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onRunEvaluation(ms)}
                            disabled={isEvaluating}
                            className="flex-1 sm:flex-none px-3 py-2.5 text-xs font-medium text-white bg-[#142C3E] hover:bg-[#1E3E56] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs min-h-[44px] cursor-pointer"
                          >
                            {isEvaluating && evaluatingMilestoneId === ms.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#167D72]" />
                                <span>{evalStage === 'retrieving' ? 'Retrieving Evidence...' : 'Evaluating with Gemini...'}</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 text-[#167D72]" />
                                <span>Evaluate Evidence</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MILESTONE SCOPE & ACCEPTANCE CRITERIA */}
      {activeTab === 'milestone-details' && currentMilestone && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-mono uppercase bg-[#142C3E] text-white px-2 py-0.5 rounded font-bold">
                Agreed Deliverable Scope
              </span>
              <span className="text-xs text-[#5B6673]">
                Created: {new Date(currentMilestone.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] break-words">{currentMilestone.title}</h1>
            <p className="text-xs sm:text-sm text-[#5B6673] mt-2 leading-relaxed break-words">{currentMilestone.description}</p>

            <div className="mt-4 pt-4 border-t border-[#DCE3E9] flex flex-wrap items-center gap-4 text-xs text-[#5B6673]">
              <div>Repository: <strong className="font-mono text-[#142C3E] break-all">{currentMilestone.repositoryUrl}</strong></div>
              <div>Evidence Source: <strong className="uppercase font-mono text-[#142C3E]">{currentMilestone.evidenceSource}</strong></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#142C3E]">Agreed Acceptance Criteria</h2>
            <div className="space-y-3">
              {currentMilestone.acceptanceCriteria?.map((crit, idx) => (
                <div key={crit.id} className="p-3.5 sm:p-4 rounded-lg border border-[#DCE3E9] bg-[#F5F7F9] flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-xs font-mono font-bold bg-white text-[#142C3E] px-2 py-0.5 rounded border border-[#DCE3E9] shrink-0 mt-0.5">
                      #{idx + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-[#17212B] leading-relaxed break-words">{crit.description}</p>
                  </div>
                  <div>{getStatusBadge(crit.status)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EVIDENCE EXPLORER */}
      {activeTab === 'evidence-explorer' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onFetchLiveEvidence}
                disabled={isFetchingEvidence}
                data-testid="grantor-fetch-live-evidence-btn"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] disabled:opacity-50 transition shadow-xs min-h-[44px] cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isFetchingEvidence ? 'animate-spin' : ''}`} />
                {isFetchingEvidence ? 'Retrieving from GitHub...' : 'Fetch Live GitHub Evidence'}
              </button>

              {liveEvidence && (
                <div className="flex items-center rounded-lg border border-[#DCE3E9] p-0.5 bg-[#F5F7F9]">
                  <button
                    type="button"
                    onClick={() => onEvidenceViewModeChange('live')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                      evidenceViewMode === 'live'
                        ? 'bg-white text-[#142C3E] shadow-2xs font-bold'
                        : 'text-[#5B6673] hover:text-[#142C3E]'
                    }`}
                  >
                    Live
                  </button>
                  <button
                    type="button"
                    onClick={() => onEvidenceViewModeChange('sample')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                      evidenceViewMode === 'sample'
                        ? 'bg-white text-[#142C3E] shadow-2xs font-bold'
                        : 'text-[#5B6673] hover:text-[#142C3E]'
                    }`}
                  >
                    Sample
                  </button>
                </div>
              )}
            </div>

            <div className="text-[11px] sm:text-xs text-[#5B6673]">
              {currentUser ? (
                <span>Grantor: <strong className="text-[#142C3E]">{currentUser.email || currentUser.displayName}</strong></span>
              ) : (
                <span className="text-[#8C5E00]">Authenticated session active</span>
              )}
            </div>
          </div>

          {evidenceNotice && (
            <div className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm border ${
              evidenceNotice.type === 'error'
                ? 'bg-[#FDF2F2] border-[#F8B4B4] text-[#9B1C1C]'
                : 'bg-[#E6F4F2] border-[#A8DDD7] text-[#167D72]'
            }`}>
              {evidenceNotice.message}
            </div>
          )}

          {/* Evidence Card Display */}
          <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#142C3E]">Retrieved Artifacts for Inspection</h2>
            <div className="divide-y divide-[#DCE3E9]">
              {(liveEvidence?.items || [
                {
                  id: 'pr-12',
                  type: 'pull_request',
                  title: 'PR #12: Add member registration form and confirmation dialog',
                  url: 'https://github.com/example/community-tools/pull/12',
                  summary: 'Implements member registration modal and validation handlers. Merged to main.'
                },
                {
                  id: 'commit-8f3c1a9',
                  type: 'commit',
                  title: 'commit 8f3c1a9: Wire up user registration API client and modal',
                  url: 'https://github.com/example/community-tools/commit/8f3c1a9',
                  summary: 'Connects registration form component to user API client.'
                }
              ]).map((ev: any) => (
                <div key={ev.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs min-w-0">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {ev.type === 'pull_request' ? (
                        <GitPullRequest className="w-4 h-4 text-[#167D72] shrink-0" />
                      ) : (
                        <GitCommit className="w-4 h-4 text-[#142C3E] shrink-0" />
                      )}
                      <span className="font-semibold text-[#142C3E] break-words">{ev.title}</span>
                    </div>
                    <p className="text-[#5B6673] leading-relaxed break-words">{ev.summary}</p>
                  </div>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#167D72] hover:underline font-mono text-[11px] shrink-0 cursor-pointer"
                  >
                    <span>Inspect</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: VERIFICATION REPORT */}
      {activeTab === 'verification-report' && (
        <div className="space-y-4 sm:space-y-6">
          {currentEvaluation ? (
            <div className="space-y-4 sm:space-y-6" data-testid="grantor-verification-report">
              {/* Report Header Card */}
              <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono uppercase bg-[#E6F4F2] text-[#167D72] px-2 py-0.5 rounded font-bold">
                    AI Verification Assessment
                  </span>
                  <span className="text-xs text-[#5B6673]">
                    Evaluated: {new Date(currentEvaluation.evaluated_at).toLocaleString()}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] break-words">
                  {currentEvaluation.milestone_title}
                </h1>
                <p className="text-xs sm:text-sm text-[#17212B] bg-[#F5F7F9] p-3.5 rounded-lg border border-[#DCE3E9] leading-relaxed break-words">
                  <strong>Assessment Summary:</strong> {currentEvaluation.overall_summary}
                </p>

                {/* Explicit Human Review Requirement Disclosure */}
                <div className="p-3 rounded-lg bg-[#FFF1D6] border border-[#F2D696] flex items-center gap-2 text-xs text-[#8C5E00]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Human Review Required:</strong> AI evaluations are strictly advisory tools to aid human diligence. Authorized Grantor review is required before funds are disbursed.
                  </span>
                </div>
              </div>

              {/* Criteria Evaluation Results */}
              <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-[#142C3E]">Grounded Findings per Acceptance Criterion</h2>
                <div className="space-y-3">
                  {currentEvaluation.criteria_results?.map((res, idx) => (
                    <div key={idx} className="p-4 rounded-lg border border-[#DCE3E9] bg-white space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-xs font-mono font-bold bg-[#F5F7F9] text-[#142C3E] px-2 py-0.5 rounded border border-[#DCE3E9] shrink-0 mt-0.5">
                            #{idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-[#142C3E] break-words">{res.criterion}</span>
                        </div>
                        <div>{getStatusBadge(res.status)}</div>
                      </div>
                      <p className="text-xs text-[#5B6673] leading-relaxed break-words pl-7">{res.explanation}</p>
                      {res.evidence && res.evidence.length > 0 && (
                        <div className="pl-7 pt-1 flex flex-wrap gap-2 text-[11px] font-mono">
                          {res.evidence.map((ev, eIdx) => (
                            <a
                              key={eIdx}
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#167D72] hover:underline bg-[#E6F4F2] px-2 py-0.5 rounded cursor-pointer"
                            >
                              <span>{ev.title}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reported Limitations & Disclosures */}
              {currentEvaluation.limitations && currentEvaluation.limitations.length > 0 && (
                <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs space-y-2 text-xs">
                  <h3 className="font-bold text-[#142C3E]">Known Evaluation Limitations</h3>
                  <ul className="list-disc list-inside text-[#5B6673] space-y-1">
                    {currentEvaluation.limitations.map((lim, lIdx) => (
                      <li key={lIdx} className="break-words">{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#DCE3E9] p-8 text-center space-y-3">
              <FileCheck2 className="w-10 h-10 text-[#5B6673] mx-auto opacity-50" />
              <h2 className="text-base font-bold text-[#142C3E]">No AI Evaluation Report Generated Yet</h2>
              <p className="text-xs text-[#5B6673] max-w-md mx-auto">
                Run an evaluation from the Grant Oversight tab to compare retrieved repository evidence against agreed acceptance criteria.
              </p>
              {currentMilestone && (
                <button
                  onClick={() => onRunEvaluation(currentMilestone)}
                  disabled={isEvaluating}
                  className="px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-4 h-4 text-[#167D72]" />
                  <span>Evaluate "{currentMilestone.title}"</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: FORMAL REVIEW & DECISION (Grantor Authority) */}
      {activeTab === 'human-review' && currentMilestone && (
        <div className="space-y-4 sm:space-y-6" data-testid="grantor-decision-screen">
          {/* Milestone Context Banner */}
          <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-mono uppercase bg-[#142C3E] text-white px-2 py-0.5 rounded font-bold">
                Consequential Review Authority
              </span>
              <span className="text-xs text-[#167D72] font-semibold">
                Milestone: {currentMilestone.id.toUpperCase()}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] break-words">
              Formal Review: "{currentMilestone.title}"
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6673] mt-1 leading-relaxed">
              As the authorized Grantor decision-maker, your judgment determines milestone approval, revision requests, or rejection based on the evidence presented.
            </p>
          </div>

          {decisionFeedback && (
            <div className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 border ${
              decisionFeedback.type === 'error'
                ? 'bg-[#FDF2F2] border-[#F8B4B4] text-[#9B1C1C]'
                : 'bg-[#E6F4F2] border-[#A8DDD7] text-[#167D72]'
            }`}>
              <span className="break-words font-medium">{decisionFeedback.message}</span>
              <button
                onClick={onDismissDecisionFeedback}
                className="text-xs font-bold underline shrink-0 min-h-[44px] px-2 flex items-center cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Existing Decision Card (if already made) */}
          {currentMilestone.humanDecision && (
            <div className="bg-white rounded-xl border border-[#167D72] p-4 sm:p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono uppercase bg-[#E6F4F2] text-[#167D72] px-2 py-0.5 rounded font-bold shrink-0">
                  Recorded Decision: {currentMilestone.humanDecision.status.toUpperCase()}
                </span>
                <span className="text-xs text-[#5B6673]">
                  {new Date(currentMilestone.humanDecision.recorded_at).toLocaleString()}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[#142C3E] break-words">
                Reviewed by {currentMilestone.humanDecision.reviewer_name} ({currentMilestone.humanDecision.reviewer_role})
              </h3>
              <p className="text-xs sm:text-sm text-[#17212B] mt-2 bg-[#F5F7F9] p-3.5 rounded-lg border border-[#DCE3E9] break-words leading-relaxed">
                <strong>Reasoning:</strong> {currentMilestone.humanDecision.reasoning}
              </p>
            </div>
          )}

          {/* Formal Decision Submission Form */}
          <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
            <h2 className="text-base font-bold text-[#142C3E] mb-3 sm:mb-4 break-words">
              Record Formal Grantor Determination
            </h2>

            <form onSubmit={onSubmitDecision} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#5B6673] mb-1">
                    Authorized Signer Identity
                  </label>
                  <input
                    type="text"
                    value={reviewerName}
                    disabled={isSubmittingDecision}
                    onChange={e => onReviewerNameChange(e.target.value)}
                    required
                    className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] disabled:bg-gray-100 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5B6673] mb-1">
                    Verified Grantor Role
                  </label>
                  <div className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-[#DCE3E9] bg-[#F5F7F9] flex items-center gap-2 min-h-[44px]">
                    <UserCheck className="w-4 h-4 text-[#167D72] shrink-0" />
                    <span className="font-semibold text-[#142C3E]">
                      Grantor (Authorized Signer)
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5B6673] mb-1">
                  Determination Choice
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {[
                    { val: 'approved', label: 'Approve Milestone', desc: 'Sufficient evidence supports criteria.' },
                    { val: 'changes_requested', label: 'Request Changes', desc: 'Evidence gaps or clarification needed.' },
                    { val: 'rejected', label: 'Reject Claim', desc: 'Evidence contradicts agreed deliverables.' }
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.val}
                      disabled={isSubmittingDecision}
                      onClick={() => onDecisionChoiceChange(opt.val as any)}
                      className={`p-3 rounded-lg border text-left transition min-h-[48px] flex flex-col justify-center disabled:opacity-60 cursor-pointer ${
                        decisionChoice === opt.val
                          ? 'border-[#167D72] bg-[#E6F4F2] text-[#142C3E]'
                          : 'border-[#DCE3E9] bg-white hover:bg-gray-50'
                      }`}
                      data-testid={`grantor-decision-choice-${opt.val}`}
                    >
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className="text-[11px] text-[#5B6673] mt-0.5 leading-snug">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5B6673] mb-1">
                  Explicit Justification & Traceable Reasoning (Required, minimum 10 characters)
                </label>
                <textarea
                  rows={4}
                  value={decisionReasoning}
                  disabled={isSubmittingDecision}
                  onChange={e => onDecisionReasoningChange(e.target.value)}
                  required
                  placeholder="Describe how the observable repository evidence supports or fails to support the agreed acceptance criteria, and detail any Grantor verifications performed..."
                  className="w-full text-xs sm:text-sm p-3 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] disabled:bg-gray-100 leading-relaxed"
                  data-testid="grantor-decision-reasoning-input"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingDecision}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#142C3E] disabled:bg-gray-400 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-[#1E3E56] transition shadow-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                  data-testid="grantor-record-decision-btn"
                >
                  <UserCheck className="w-4 h-4 text-[#167D72]" />
                  {isSubmittingDecision ? 'Verifying & Recording...' : 'Record & Sign Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT TRAIL & COMPLIANCE */}
      {activeTab === 'audit-history' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="min-w-0">
              <span className="text-xs font-mono uppercase text-[#167D72] font-semibold">
                Traceability & Governance Integrity
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] break-words">
                Grantor Audit Trail
              </h1>
              <p className="text-xs text-[#5B6673] mt-1 break-words">
                Chronological, non-repudiable log of milestones, AI assessments, and formal Grantor decisions persisted in Firestore.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCE3E9] overflow-hidden shadow-xs">
            <div className="px-4 sm:px-6 py-3.5 border-b border-[#DCE3E9] flex items-center justify-between bg-gray-50">
              <span className="text-xs font-bold uppercase text-[#5B6673]">Audit Event Timeline</span>
              <span className="text-xs font-mono text-[#5B6673]">{auditLogs.length} Events Logged</span>
            </div>

            <div className="divide-y divide-[#DCE3E9]">
              {auditLogs.map(log => (
                <div key={log.id} className="p-4 sm:p-6 hover:bg-gray-50 transition min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono bg-[#142C3E] text-white px-2 py-0.5 rounded font-semibold uppercase">
                        {log.entityType}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#142C3E] break-words">{log.action}</span>
                    </div>
                    <span className="text-[11px] sm:text-xs font-mono text-[#5B6673]">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#17212B] break-words leading-relaxed">{log.details}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5B6673] font-mono min-w-0">
                    <span className="break-all">Actor: <strong className="text-[#142C3E]">{log.actor}</strong></span>
                    <span>•</span>
                    <span className="break-all">Target: {log.entityId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
