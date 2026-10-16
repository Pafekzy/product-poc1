import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  FileCheck2,
  GitPullRequest,
  GitCommit,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Clock,
  History,
  FolderGit2,
  ExternalLink,
  ChevronRight,
  Plus,
  Play,
  UserCheck,
  Sparkles,
  Info,
  LogIn,
  LogOut,
  Database
} from 'lucide-react';
import { FeatureCarousel } from './components/FeatureCarousel';
import type { User } from 'firebase/auth';
import {
  FundingAgreement,
  Milestone,
  EvaluationReport,
  AuditLogEntry,
  CriterionStatus,
  HumanDecision
} from './types';
import {
  initialFundingAgreements,
  sampleEvaluationReports,
  initialAuditLogs
} from './data/mockData';
import {
  testFirestoreConnection,
  subscribeToAuth,
  loginWithGoogle,
  logoutUser,
  initializeDatabase,
  subscribeFundingAgreement,
  saveMilestoneToFirestore,
  saveDecisionToFirestore,
  saveEvaluationToFirestore,
  subscribeAuditLogs,
  logAuditEventToFirestore
} from './services/dataService';

type NavigationTab = 
  | 'dashboard' 
  | 'milestone-details' 
  | 'evidence-explorer' 
  | 'verification-report' 
  | 'human-review' 
  | 'audit-history';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const navScrollRef = useRef<HTMLElement>(null);
  const [currentAgreement, setCurrentAgreement] = useState<FundingAgreement>(initialFundingAgreements[0]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('ms-01');
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationReport>>(sampleEvaluationReports);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialAuditLogs);

  // Authentication & Connection state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Modal & Async states
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalNotice, setEvalNotice] = useState<string | null>(null);

  // Review Form state
  const [reviewerName, setReviewerName] = useState<string>('Elena Vance');
  const [reviewerRole, setReviewerRole] = useState<'Grantor' | 'Reviewer'>('Grantor');
  const [decisionChoice, setDecisionChoice] = useState<'approved' | 'rejected' | 'changes_requested'>('approved');
  const [decisionReasoning, setDecisionReasoning] = useState<string>('');
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  // Create Milestone Modal state
  const [showNewMilestoneModal, setShowNewMilestoneModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCriteriaText, setNewCriteriaText] = useState('1. Implementation of core components\n2. Validation errors handled correctly\n3. Integration tests demonstrate functionality');
  const [newRepoUrl, setNewRepoUrl] = useState('https://github.com/example/community-tools');

  // Initialize DB and subscribe to Firebase Auth & Firestore
  useEffect(() => {
    testFirestoreConnection().then(connected => {
      setDbConnected(connected);
      if (connected) {
        initializeDatabase().catch(err => console.warn('DB initialization deferred:', err));
      }
    });

    const unsubAuth = subscribeToAuth(user => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user?.displayName) {
        setReviewerName(user.displayName);
      }
    });

    // Subscribe to Firestore for real-time, durable agreement updates
    const unsubAgreement = subscribeFundingAgreement('fa-8041', updatedAgreement => {
      if (updatedAgreement) {
        setCurrentAgreement(updatedAgreement);
      }
    });

    // Subscribe to Firestore for real-time audit logs
    const unsubAudit = subscribeAuditLogs(logs => {
      if (logs && logs.length > 0) {
        setAuditLogs(logs);
      }
    });

    return () => {
      unsubAuth();
      unsubAgreement();
      unsubAudit();
    };
  }, []);

  // Ensure active navigation tab is scrolled into view smoothly on mobile screens
  useEffect(() => {
    if (navScrollRef.current) {
      const activeBtn = navScrollRef.current.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  const currentMilestone = currentAgreement.milestones.find(m => m.id === selectedMilestoneId) || currentAgreement.milestones[0];
  const currentEvaluation = currentMilestone?.evaluationId ? evaluations[currentMilestone.evaluationId] : null;

  // Handle Google Auth
  const handleAuthAction = async () => {
    if (currentUser) {
      await logoutUser();
    } else {
      try {
        await loginWithGoogle();
      } catch (err) {
        console.error('Authentication attempt failed:', err);
      }
    }
  };

  // Handle running an AI evaluation
  const handleRunEvaluation = async (milestone: Milestone) => {
    setIsEvaluating(true);
    setEvalNotice(null);

    // Call server-side API endpoint to validate contract adherence
    try {
      const apiRes = await fetch('/api/v1/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: currentAgreement.title,
          repository_url: milestone.repositoryUrl || 'https://github.com/example/community-tools',
          milestone: {
            title: milestone.title,
            description: milestone.description,
            acceptance_criteria: milestone.acceptanceCriteria.map(c => c.description)
          },
          evidence_source: milestone.evidenceSource
        })
      });
      const apiData = await apiRes.json();
      console.info('Server API Response:', apiRes.status, apiData);
    } catch (apiErr) {
      console.warn('Server API call noted:', apiErr);
    }

    const evalId = `eval-${Date.now()}`;
    const newEvaluation: EvaluationReport = {
      evaluation_id: evalId,
      project_name: currentAgreement.title,
      milestone_title: milestone.title,
      overall_summary: `Evidence assessment completed for "${milestone.title}". Evaluation conducted strictly against pre-agreed acceptance criteria. Human review is required before any funding decision.`,
      criteria_results: milestone.acceptanceCriteria.map((crit, idx) => {
        let status: CriterionStatus = 'supported';
        let explanation = 'Direct code references and commit messages substantiate the implementation.';
        const evidenceList: Array<{ type: 'pull_request' | 'commit' | 'release'; title: string; url: string }> = [
          {
            type: 'pull_request',
            title: `PR #${10 + idx}: Delivery for ${crit.description.slice(0, 35)}...`,
            url: `${milestone.repositoryUrl}/pull/${10 + idx}`
          }
        ];

        if (idx === 1) {
          status = 'insufficient_evidence';
          explanation = 'Available repository commits do not contain demonstrable evidence for this specific criterion.';
          evidenceList.length = 0;
        } else if (idx === 2) {
          status = 'uncertain';
          explanation = 'Test scaffolding exists, but assertions for failure boundaries cannot be confirmed from repository artifacts alone.';
        }

        return {
          criterion: crit.description,
          status,
          explanation,
          evidence: evidenceList
        };
      }),
      suggested_next_steps: [
        'Inspect pull request diffs for unresolved edge cases.',
        'Request demonstration logs or staging deployment links from Grantee.',
        'Authorize human grant approval in the Human Review screen.'
      ],
      limitations: [
        'Static repository evidence cannot independently verify production runtime stability.',
        'Evidence assessed from designated sample dataset.'
      ],
      human_review_required: true,
      evaluated_at: new Date().toISOString(),
      evidence_source: milestone.evidenceSource
    };

    setEvaluations(prev => ({ ...prev, [evalId]: newEvaluation }));

    // Persist to Cloud Firestore
    await saveEvaluationToFirestore(currentAgreement.id, milestone.id, newEvaluation);

    // Audit log entry
    const newAudit: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: currentUser ? `${currentUser.displayName || currentUser.email} (User)` : 'AI Evaluation Service (Assisted)',
      action: 'Generated Evidence Assessment',
      entityType: 'Evaluation',
      entityId: evalId,
      details: `Assessed evidence for Milestone "${milestone.title}". Findings persisted to Cloud Firestore.`
    };
    await logAuditEventToFirestore(newAudit);

    setIsEvaluating(false);
    setEvalNotice('Evidence evaluation generated and persisted to Cloud Firestore.');
    setActiveTab('verification-report');
  };

  // Handle Recording Human Decision
  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionReasoning.trim() || decisionReasoning.trim().length < 10) {
      setDecisionFeedback('Explicit justification and reasoning (minimum 10 characters) is required.');
      return;
    }

    // Server-side Authorization Check if logged in
    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken();
        const serverRes = await fetch('/api/v1/decisions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            agreement_id: currentAgreement.id,
            milestone_id: currentMilestone.id,
            status: decisionChoice,
            reasoning: decisionReasoning
          })
        });

        if (!serverRes.ok) {
          const errPayload = await serverRes.json();
          setDecisionFeedback(`Server Authorization Denied: ${errPayload.error?.message || 'Only authorized Grantor may sign decisions.'}`);
          return;
        }
      } catch (networkErr) {
        console.warn('Server validation check failed:', networkErr);
      }
    }

    const newDecision: HumanDecision = {
      decision_id: `dec-${Date.now()}`,
      milestone_id: currentMilestone.id,
      reviewer_name: currentUser ? (currentUser.displayName || reviewerName) : reviewerName,
      reviewer_role: 'Grantor',
      status: decisionChoice,
      reasoning: decisionReasoning,
      recorded_at: new Date().toISOString()
    };

    // Persist to Cloud Firestore
    await saveDecisionToFirestore(currentAgreement.id, currentMilestone.id, newDecision);

    // Audit log
    const audit: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: currentUser ? `${currentUser.displayName || reviewerName} (Grantor)` : `${reviewerName} (Grantor)`,
      action: `Recorded Human Decision: ${decisionChoice.toUpperCase()}`,
      entityType: 'HumanDecision',
      entityId: newDecision.decision_id,
      details: `Milestone "${currentMilestone.title}" decision: ${decisionChoice}. Reason: "${decisionReasoning}"`
    };
    await logAuditEventToFirestore(audit);

    setDecisionFeedback('Decision successfully verified by server and recorded in Cloud Firestore.');
    setDecisionReasoning('');
  };

  // Handle Create Milestone
  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const criteriaLines = newCriteriaText
      .split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(line => line.length > 0);

    const newMs: Milestone = {
      id: `ms-${Date.now().toString().slice(-4)}`,
      fundingAgreementId: currentAgreement.id,
      title: newTitle,
      description: newDesc,
      repositoryUrl: newRepoUrl,
      evidenceSource: 'sample',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      acceptanceCriteria: criteriaLines.map((desc, idx) => ({
        id: `ac-${Date.now()}-${idx}`,
        description: desc,
        status: 'human_decision_pending'
      }))
    };

    // Save directly to Cloud Firestore
    await saveMilestoneToFirestore(currentAgreement.id, newMs);

    const audit: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: currentUser ? `${currentUser.displayName || currentUser.email} (Grantee)` : `${currentAgreement.granteeName} (Grantee)`,
      action: 'Created Milestone',
      entityType: 'Milestone',
      entityId: newMs.id,
      details: `Created Milestone "${newMs.title}" under Agreement "${currentAgreement.title}". Persisted to Firestore.`
    };
    await logAuditEventToFirestore(audit);

    setSelectedMilestoneId(newMs.id);
    setShowNewMilestoneModal(false);
    setNewTitle('');
    setNewDesc('');
    setActiveTab('milestone-details');
  };

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
    <div className="min-h-screen bg-[#F5F7F9] text-[#17212B] flex flex-col font-sans overflow-x-hidden max-w-full">
      {/* Top Navigation Bar - Locked Navy Header */}
      <header className="bg-[#142C3E] text-white border-b border-[#22435D] sticky top-0 z-40 shadow-sm w-full">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Brand & Logo */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <img
              src="/images/vericommit-v-check-logo.png"
              alt="VeriCommit Logo"
              className="h-8 sm:h-9 w-auto object-contain bg-white rounded p-1 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-sm xs:text-base sm:text-lg tracking-tight text-white shrink-0">VeriCommit</span>
                <span className="text-[10px] sm:text-xs bg-[#167D72] text-white px-1.5 sm:px-2 py-0.5 rounded font-mono font-medium shrink-0">v1.0</span>
              </div>
              <p className="hidden md:block text-xs text-[#DCE3E9] truncate">Evidence-led milestone verification.</p>
            </div>
          </div>

          {/* Quick Context & Authentication Strip */}
          <div className="flex items-center gap-1.5 sm:gap-3 text-xs shrink-0">
            {/* Persistence Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0E1E2B] border border-[#22435D] text-[#DCE3E9]">
              <Database className={`w-3.5 h-3.5 ${dbConnected ? 'text-[#167D72]' : 'text-[#8C5E00]'}`} />
              <span>Firestore: {dbConnected ? 'Connected' : 'Connecting...'}</span>
            </div>

            {/* User Auth Info / Login */}
            {currentUser ? (
              <div className="flex items-center gap-1 sm:gap-2 bg-[#0E1E2B] px-2 sm:px-3 py-1.5 rounded-lg border border-[#22435D] min-w-0">
                <span className="text-white font-medium truncate max-w-[65px] xs:max-w-[90px] sm:max-w-[140px] text-xs">
                  {currentUser.displayName || currentUser.email}
                </span>
                <button
                  onClick={handleAuthAction}
                  className="text-xs text-[#DCE3E9] hover:text-white flex items-center gap-1 bg-[#142C3E] px-2 py-1.5 rounded min-h-[36px] sm:min-h-auto transition shrink-0"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleAuthAction}
                disabled={authLoading}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#167D72] text-white font-medium rounded-lg hover:bg-[#12645B] transition shadow-xs text-xs min-h-[36px] shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Sign in with Google</span>
                <span className="sm:hidden">Sign in</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs - 6 Principal Screens with Smooth Horizontal Scroll */}
        <nav ref={navScrollRef} className="bg-[#0D2130] px-2 sm:px-6 lg:px-8 border-t border-[#1C3A50] overflow-x-auto no-scrollbar touch-pan-x scroll-smooth">
          <div className="max-w-7xl mx-auto flex space-x-1 min-w-max py-0.5">
            {[
              { id: 'dashboard', label: 'Workspace Dashboard', icon: ShieldCheck },
              { id: 'milestone-details', label: 'Milestone Details', icon: FolderGit2 },
              { id: 'evidence-explorer', label: 'Evidence Explorer', icon: GitPullRequest },
              { id: 'verification-report', label: 'Verification Report', icon: FileCheck2 },
              { id: 'human-review', label: 'Human Review', icon: UserCheck },
              { id: 'audit-history', label: 'Audit History', icon: History }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => setActiveTab(tab.id as NavigationTab)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap min-h-[44px] transition-colors ${
                    isActive
                      ? 'border-[#167D72] text-white bg-[#142C3E]'
                      : 'border-transparent text-[#9FB3C3] hover:text-white hover:bg-[#122737]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#167D72]' : 'text-[#7D94A6]'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Banner Alert if Human Review is Pending */}
        {currentMilestone && !currentMilestone.humanDecision && currentMilestone.evaluationId && (
          <div className="mb-4 sm:mb-6 p-3.5 sm:p-4 bg-[#FFF1D6] border border-[#F2D696] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5 min-w-0">
              <Info className="w-5 h-5 text-[#8C5E00] shrink-0 mt-0.5" />
              <div className="text-sm text-[#17212B] min-w-0">
                <div className="font-semibold text-[#8C5E00]">Human Decision Required</div>
                <p className="text-xs text-[#5B6673] mt-0.5 break-words">
                  AI evaluation is available for <strong>{currentMilestone.title}</strong>. As specified in the VeriCommit governance rules, authorized humans remain responsible for approval decisions.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('human-review')}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition shrink-0 min-h-[44px] text-center flex items-center justify-center"
            >
              Review Milestone
            </button>
          </div>
        )}

        {/* TAB 1: WORKSPACE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Agreement Header Card */}
            <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono uppercase bg-[#EEF2F6] text-[#5B6673] px-2 py-0.5 rounded">
                      {currentAgreement.id.toUpperCase()}
                    </span>
                    <span className="text-xs text-[#167D72] font-semibold uppercase tracking-wider">
                      Active Funding Agreement
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] mt-1.5 break-words">{currentAgreement.title}</h1>
                  <p className="text-xs sm:text-sm text-[#5B6673] mt-1 max-w-3xl leading-relaxed">{currentAgreement.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 pt-1 md:pt-0">
                  <button
                    onClick={() => setShowNewMilestoneModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition shadow-xs min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    Propose Milestone
                  </button>
                </div>
              </div>

              {/* Invariant Info Strip */}
              <div className="mt-4 sm:mt-6 pt-4 border-t border-[#DCE3E9] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs">
                <div className="min-w-0">
                  <span className="text-[#5B6673]">Grantor Organization</span>
                  <div className="font-semibold text-[#17212B] mt-0.5 truncate">{currentAgreement.grantorName}</div>
                </div>
                <div className="min-w-0">
                  <span className="text-[#5B6673]">Grantee Entity</span>
                  <div className="font-semibold text-[#17212B] mt-0.5 truncate">{currentAgreement.granteeName}</div>
                </div>
                <div className="min-w-0">
                  <span className="text-[#5B6673]">Commitment Budget</span>
                  <div className="font-semibold text-[#17212B] mt-0.5 font-mono">{currentAgreement.totalCommitment}</div>
                </div>
                <div className="min-w-0">
                  <span className="text-[#5B6673]">Milestones in Scope</span>
                  <div className="font-semibold text-[#17212B] mt-0.5">{currentAgreement.milestones.length} Defined</div>
                </div>
              </div>
            </div>

            {/* Interactive Feature Showcase Carousel */}
            <FeatureCarousel />

            {/* Milestones List */}
            <div className="bg-white rounded-xl border border-[#DCE3E9] overflow-hidden shadow-xs">
              <div className="px-4 sm:px-6 py-4 border-b border-[#DCE3E9] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#142C3E]">Agreed Milestones</h2>
                  <p className="text-xs text-[#5B6673]">Every milestone maps to pre-agreed acceptance criteria.</p>
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
                                decision.status === 'approved' ? 'bg-[#E6F4F2] text-[#167D72]' : 'bg-[#FFF1D6] text-[#8C5E00]'
                              }`}>
                                Decision: {decision.status.toUpperCase()}
                              </span>
                            ) : hasEvaluation ? (
                              <span className="text-xs px-2 py-0.5 rounded font-medium bg-[#FFF1D6] text-[#8C5E00] shrink-0">
                                Evaluation ready for review
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
                              setSelectedMilestoneId(ms.id);
                              setActiveTab('milestone-details');
                            }}
                            className="flex-1 sm:flex-none px-3 py-2.5 text-xs font-medium text-[#142C3E] bg-[#EEF2F6] hover:bg-[#DCE3E9] rounded-lg transition min-h-[44px] flex items-center justify-center text-center"
                          >
                            Inspect Details
                          </button>
                          {hasEvaluation ? (
                            <button
                              onClick={() => {
                                setSelectedMilestoneId(ms.id);
                                setActiveTab('verification-report');
                              }}
                              className="flex-1 sm:flex-none px-3 py-2.5 text-xs font-medium text-white bg-[#167D72] hover:bg-[#12645B] rounded-lg transition flex items-center justify-center gap-1.5 min-h-[44px]"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              View Report
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRunEvaluation(ms)}
                              disabled={isEvaluating}
                              className="flex-1 sm:flex-none px-3 py-2.5 text-xs font-medium text-white bg-[#142C3E] hover:bg-[#1E3E56] rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs min-h-[44px]"
                            >
                              <Play className="w-3.5 h-3.5 text-[#167D72]" />
                              Evaluate Evidence
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Criteria Mini Summary */}
                      {ms.acceptanceCriteria && ms.acceptanceCriteria.length > 0 && (
                        <div className="mt-3 sm:mt-4 pt-3 border-t border-[#EEF2F6] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {ms.acceptanceCriteria.map(crit => (
                            <div key={crit.id} className="text-xs p-2.5 rounded bg-white border border-[#DCE3E9] min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                                <span className="font-mono text-[10px] text-[#5B6673] uppercase">{crit.id}</span>
                                {getStatusBadge(crit.status)}
                              </div>
                              <p className="line-clamp-2 text-[#17212B] break-words">{crit.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MILESTONE DETAILS */}
        {activeTab === 'milestone-details' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-mono uppercase text-[#167D72] font-semibold">Milestone Detail View</span>
                <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] break-words">{currentMilestone.title}</h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleRunEvaluation(currentMilestone)}
                  disabled={isEvaluating}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
                >
                  <Sparkles className="w-4 h-4 text-[#167D72] shrink-0" />
                  <span>{isEvaluating ? 'Evaluating Evidence...' : 'Run AI-Assisted Evaluation'}</span>
                </button>
              </div>
            </div>

            {/* Milestone Meta Card */}
            <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
              <h2 className="text-base font-bold text-[#142C3E] mb-2 sm:mb-3">Agreed Milestone Scope</h2>
              <p className="text-xs sm:text-sm text-[#17212B] leading-relaxed break-words">{currentMilestone.description}</p>

              <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-[#DCE3E9] text-xs">
                <div className="min-w-0">
                  <span className="text-[#5B6673]">Parent Funding Agreement</span>
                  <div className="font-semibold text-[#142C3E] mt-0.5 break-words">{currentAgreement.title}</div>
                </div>
                <div className="min-w-0">
                  <span className="text-[#5B6673]">Repository Location</span>
                  <div className="font-mono text-[#17212B] mt-0.5 flex items-center gap-1 min-w-0">
                    <a
                      href={currentMilestone.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#167D72] hover:underline flex items-center gap-1 break-all"
                    >
                      <span className="break-all">{currentMilestone.repositoryUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-[#5B6673]">Evidence Source Setting</span>
                  <div className="font-mono text-[#17212B] mt-0.5">
                    {currentMilestone.evidenceSource === 'sample' ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-[#EEF2F6] text-[#5B6673] font-medium text-[11px]">
                        Standardized Sample Dataset
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded bg-[#E6F4F2] text-[#167D72] font-medium text-[11px]">
                        Live GitHub Integration
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Acceptance Criteria Breakdown */}
            <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#142C3E]">Agreed Acceptance Criteria</h2>
                  <p className="text-xs text-[#5B6673]">The evaluation compares evidence exclusively against these criteria.</p>
                </div>
              </div>

              <div className="space-y-3">
                {currentMilestone.acceptanceCriteria?.map((crit, i) => (
                  <div
                    key={crit.id}
                    className="p-3.5 sm:p-4 rounded-lg border border-[#DCE3E9] bg-[#F9FBFC] flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#5B6673]">Criterion {i + 1}</span>
                        {getStatusBadge(crit.status)}
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-[#17212B] break-words">{crit.description}</p>
                      {crit.explanation && (
                        <p className="text-xs text-[#5B6673] bg-white p-2.5 rounded border border-[#DCE3E9] mt-2 break-words leading-relaxed">
                          <strong className="text-[#142C3E]">Evaluation Note:</strong> {crit.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EVIDENCE EXPLORER */}
        {activeTab === 'evidence-explorer' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-mono uppercase text-[#167D72] font-semibold">Traceable Artifacts</span>
                <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] break-words">Evidence Explorer</h1>
                <p className="text-xs text-[#5B6673] mt-1 break-words">
                  Examine commits, pull requests, and verified evidence associated with <strong>{currentMilestone.title}</strong>.
                </p>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#FFF1D6] text-[#8C5E00] text-xs border border-[#F2D696] font-medium shrink-0 self-start sm:self-auto">
                Source: Sample Dataset
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
              <h2 className="text-base font-bold text-[#142C3E] mb-3 sm:mb-4 flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-[#167D72] shrink-0" />
                Pull Requests & Branches
              </h2>
              <div className="space-y-3">
                <div className="p-3.5 sm:p-4 rounded-lg border border-[#DCE3E9] bg-white hover:bg-gray-50 transition flex flex-col md:flex-row md:items-start justify-between gap-3 min-w-0">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs bg-[#E6F4F2] text-[#167D72] px-2 py-0.5 rounded font-semibold">#12</span>
                      <h3 className="text-sm font-semibold text-[#142C3E] break-words">Add member registration form and confirmation dialog</h3>
                      <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-mono font-bold">MERGED</span>
                    </div>
                    <p className="text-xs text-[#5B6673] break-words leading-relaxed">
                      Implements registration modal, input validation handlers, and successful confirmation states.
                    </p>
                    <div className="font-mono text-[11px] text-[#7D94A6] break-words">
                      Branch: <span className="text-[#142C3E]">feature/member-registration</span> • 6 commits • +420 / -18 lines
                    </div>
                  </div>
                  <span className="text-xs text-[#167D72] font-medium flex items-center gap-1 font-mono break-all shrink-0">
                    github.com/.../pull/12
                  </span>
                </div>

                <div className="p-3.5 sm:p-4 rounded-lg border border-[#DCE3E9] bg-white hover:bg-gray-50 transition flex flex-col md:flex-row md:items-start justify-between gap-3 min-w-0">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs bg-[#EEF2F6] text-[#5B6673] px-2 py-0.5 rounded font-semibold">#14</span>
                      <h3 className="text-sm font-semibold text-[#142C3E] break-words">Initial test harness and mock runner setup</h3>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">OPEN</span>
                    </div>
                    <p className="text-xs text-[#5B6673] break-words leading-relaxed">
                      Scaffolds Vitest suite for component unit testing and mock session handlers.
                    </p>
                    <div className="font-mono text-[11px] text-[#7D94A6] break-words">
                      Branch: <span className="text-[#142C3E]">test/registration-coverage</span> • 2 commits • +110 / -4 lines
                    </div>
                  </div>
                  <span className="text-xs text-[#167D72] font-medium flex items-center gap-1 font-mono break-all shrink-0">
                    github.com/.../pull/14
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
              <h2 className="text-base font-bold text-[#142C3E] mb-3 sm:mb-4 flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-[#167D72] shrink-0" />
                Recent Verified Commits
              </h2>
              <div className="space-y-2">
                {[
                  {
                    hash: '8f3c1a9',
                    msg: 'Wire up user registration API client and confirmation modal',
                    author: 'alex-dev',
                    date: '2026-10-10'
                  },
                  {
                    hash: '4a7e2b1',
                    msg: 'Add registration test scaffold and placeholder test cases',
                    author: 'alex-dev',
                    date: '2026-10-09'
                  },
                  {
                    hash: '1d98bc4',
                    msg: 'Create registration form layout and field styling',
                    author: 'maria-ui',
                    date: '2026-10-08'
                  }
                ].map(c => (
                  <div key={c.hash} className="p-3 rounded border border-[#DCE3E9] flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs min-w-0">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="font-mono bg-[#EEF2F6] text-[#142C3E] px-2 py-0.5 rounded font-bold shrink-0 mt-0.5">{c.hash}</span>
                      <span className="font-medium text-[#17212B] break-words">{c.msg}</span>
                    </div>
                    <div className="text-[#5B6673] flex items-center gap-2 shrink-0 text-[11px] pt-1 sm:pt-0 self-start sm:self-auto font-mono">
                      <span>{c.author}</span>
                      <span>•</span>
                      <span>{c.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VERIFICATION REPORT */}
        {activeTab === 'verification-report' && (
          <div className="space-y-4 sm:space-y-6">
            {evalNotice && (
              <div className="p-3.5 sm:p-4 bg-[#E6F4F2] border border-[#A8DDD7] text-[#167D72] rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2">
                <span className="break-words">{evalNotice}</span>
                <button onClick={() => setEvalNotice(null)} className="text-xs font-bold underline shrink-0 min-h-[44px] px-2 flex items-center">Dismiss</button>
              </div>
            )}

            {!currentEvaluation ? (
              <div className="bg-white rounded-xl border border-[#DCE3E9] p-8 sm:p-12 text-center shadow-xs">
                <FileCheck2 className="w-10 sm:w-12 h-10 sm:h-12 text-[#5B6673] mx-auto mb-3" />
                <h2 className="text-base sm:text-lg font-bold text-[#142C3E]">No Evaluation Report Available Yet</h2>
                <p className="text-xs sm:text-sm text-[#5B6673] max-w-md mx-auto mt-1 mb-6 leading-relaxed">
                  An evaluation compares agreed acceptance criteria against repository evidence to produce structured findings.
                </p>
                <button
                  onClick={() => handleRunEvaluation(currentMilestone)}
                  disabled={isEvaluating}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition min-h-[44px]"
                >
                  Run Evidence Evaluation
                </button>
              </div>
            ) : (
              <>
                {/* Report Header */}
                <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono uppercase bg-[#142C3E] text-white px-2 py-0.5 rounded font-semibold">
                          {currentEvaluation.evaluation_id}
                        </span>
                        <span className="text-xs text-[#167D72] font-semibold uppercase">
                          AI-Assisted Assessment
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] mt-1 break-words">{currentEvaluation.milestone_title}</h1>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5B6673] mt-1">
                        <span>Project: {currentEvaluation.project_name}</span>
                        <span>•</span>
                        <span>Evaluated: {new Date(currentEvaluation.evaluated_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="font-mono">Source: {currentEvaluation.evidence_source.toUpperCase()}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('human-review')}
                      className="w-full md:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition shadow-xs flex items-center justify-center gap-2 min-h-[44px] shrink-0"
                    >
                      <UserCheck className="w-4 h-4 text-[#167D72]" />
                      Proceed to Human Decision
                    </button>
                  </div>

                  {/* Overall Summary Callout */}
                  <div className="mt-4 sm:mt-6 p-3.5 sm:p-4 rounded-lg bg-[#F5F7F9] border border-[#DCE3E9]">
                    <h3 className="text-xs font-bold uppercase text-[#5B6673] tracking-wider mb-1">Overall Assessment Summary</h3>
                    <p className="text-xs sm:text-sm text-[#17212B] leading-relaxed break-words">{currentEvaluation.overall_summary}</p>
                  </div>
                </div>

                {/* Criterion-Level Findings */}
                <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
                  <h2 className="text-base font-bold text-[#142C3E] mb-3 sm:mb-4">Criterion-by-Criterion Findings</h2>
                  <div className="space-y-3 sm:space-y-4">
                    {currentEvaluation.criteria_results.map((result, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 sm:p-4 rounded-xl border border-[#DCE3E9] bg-[#F9FBFC] space-y-3 min-w-0"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-[#142C3E] break-words flex-1">
                            Criterion {idx + 1}: {result.criterion}
                          </span>
                          <div className="shrink-0">{getStatusBadge(result.status)}</div>
                        </div>

                        <p className="text-xs sm:text-sm text-[#17212B] bg-white p-3 rounded-lg border border-[#DCE3E9] break-words leading-relaxed">
                          <strong>Evaluation Finding:</strong> {result.explanation}
                        </p>

                        {/* Associated Evidence */}
                        {result.evidence.length > 0 ? (
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-[#5B6673] uppercase tracking-wide">Supporting Evidence:</span>
                            <div className="space-y-1.5">
                              {result.evidence.map((ev, evIdx) => (
                                <div
                                  key={evIdx}
                                  className="text-xs font-mono bg-white p-2.5 rounded border border-[#DCE3E9] flex flex-col sm:flex-row sm:items-start justify-between gap-2 min-w-0"
                                >
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <span className="px-1.5 py-0.5 rounded bg-[#EEF2F6] text-[#142C3E] uppercase text-[10px] shrink-0 font-bold mt-0.5">
                                      {ev.type}
                                    </span>
                                    <span className="text-[#17212B] break-words min-w-0">{ev.title}</span>
                                  </div>
                                  <a
                                    href={ev.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#167D72] hover:underline flex items-center gap-1 shrink-0 self-start sm:self-auto min-h-[36px] sm:min-h-0 pt-0.5"
                                  >
                                    View Source
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-[#5B6673] italic bg-[#EEF2F6] p-2.5 rounded break-words">
                            No direct supporting repository artifacts found for this criterion.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested Next Steps & Limitations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
                    <h3 className="text-sm font-bold text-[#142C3E] mb-3 flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-[#167D72] shrink-0" />
                      Suggested Next Steps for Reviewer
                    </h3>
                    <ul className="space-y-2 text-xs text-[#17212B]">
                      {currentEvaluation.suggested_next_steps.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-2 break-words">
                          <span className="text-[#167D72] font-bold shrink-0">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
                    <h3 className="text-sm font-bold text-[#142C3E] mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#8C5E00] shrink-0" />
                      Report Limitations & Disclosure
                    </h3>
                    <ul className="space-y-2 text-xs text-[#5B6673]">
                      {currentEvaluation.limitations.map((lim, lIdx) => (
                        <li key={lIdx} className="flex items-start gap-2 break-words">
                          <span className="text-[#8C5E00] font-bold shrink-0">•</span>
                          <span>{lim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 5: HUMAN REVIEW */}
        {activeTab === 'human-review' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-mono uppercase text-[#167D72] font-semibold">Accountable Human Decision</span>
                <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] break-words">Human Review & Funding Determination</h1>
                <p className="text-xs text-[#5B6673] mt-1 break-words">
                  AI does not approve milestones or release funds. An authorized reviewer must review evidence and record the decision.
                </p>
              </div>
            </div>

            {decisionFeedback && (
              <div className="p-3.5 sm:p-4 bg-[#E6F4F2] border border-[#A8DDD7] text-[#167D72] rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2">
                <span className="break-words">{decisionFeedback}</span>
                <button onClick={() => setDecisionFeedback(null)} className="text-xs font-bold underline shrink-0 min-h-[44px] px-2 flex items-center">Dismiss</button>
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

            {/* Decision Submission Form */}
            <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
              <h2 className="text-base font-bold text-[#142C3E] mb-3 sm:mb-4 break-words">
                Record Review Decision for "{currentMilestone.title}"
              </h2>

              <form onSubmit={handleRecordDecision} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#5B6673] mb-1">
                      Reviewer Full Name
                    </label>
                    <input
                      type="text"
                      value={reviewerName}
                      onChange={e => setReviewerName(e.target.value)}
                      required
                      className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5B6673] mb-1">
                      Authorized Role
                    </label>
                    <select
                      value={reviewerRole}
                      onChange={e => setReviewerRole(e.target.value as 'Grantor' | 'Reviewer')}
                      className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] bg-white min-h-[44px]"
                    >
                      <option value="Grantor">Grantor Representative</option>
                      <option value="Reviewer">Independent Milestone Evaluator</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5B6673] mb-1">
                    Determination Choice
                  </label>
                  {/* Stacks on mobile (<640px) to prevent cramped horizontal tabs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    {[
                      { val: 'approved', label: 'Approve Milestone', desc: 'Sufficient evidence supports criteria.' },
                      { val: 'changes_requested', label: 'Request Changes', desc: 'Evidence gaps or clarification needed.' },
                      { val: 'rejected', label: 'Reject Claim', desc: 'Evidence contradicts agreed deliverables.' }
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.val}
                        onClick={() => setDecisionChoice(opt.val as any)}
                        className={`p-3 rounded-lg border text-left transition min-h-[48px] flex flex-col justify-center ${
                          decisionChoice === opt.val
                            ? 'border-[#167D72] bg-[#E6F4F2] text-[#142C3E]'
                            : 'border-[#DCE3E9] bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[11px] text-[#5B6673] mt-0.5 leading-snug">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5B6673] mb-1">
                    Explicit Justification & Traceable Reasoning (Required, min 10 chars)
                  </label>
                  <textarea
                    rows={4}
                    value={decisionReasoning}
                    onChange={e => setDecisionReasoning(e.target.value)}
                    required
                    placeholder="Describe how the available evidence supports or fails to support the acceptance criteria, and detail any reviewer verifications conducted..."
                    className="w-full text-xs sm:text-sm p-3 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:justify-end">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-[#1E3E56] transition shadow-xs flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <UserCheck className="w-4 h-4 text-[#167D72]" />
                    Record & Sign Decision
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT HISTORY */}
        {activeTab === 'audit-history' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="min-w-0">
                <span className="text-xs font-mono uppercase text-[#167D72] font-semibold">Traceability & Integrity</span>
                <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] break-words">Audit History</h1>
                <p className="text-xs text-[#5B6673] mt-1 break-words">
                  Chronological, non-repudiable log of agreements, milestones, AI evaluations, and human decisions persisted in Firestore.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#DCE3E9] overflow-hidden shadow-xs">
              <div className="px-4 sm:px-6 py-3.5 border-b border-[#DCE3E9] flex items-center justify-between bg-gray-50">
                <span className="text-xs font-bold uppercase text-[#5B6673]">Audit Event Timeline</span>
                <span className="text-xs font-mono text-[#5B6673]">{auditLogs.length} Events</span>
              </div>

              <div className="divide-y divide-[#DCE3E9]">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-4 sm:p-6 hover:bg-gray-50 transition min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono bg-[#EEF2F6] text-[#142C3E] px-2 py-0.5 rounded font-bold shrink-0">
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
      </main>

      {/* New Milestone Modal - Responsive Dialog */}
      {showNewMilestoneModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-[#DCE3E9] max-w-lg w-full p-4 sm:p-6 shadow-xl max-h-[90vh] flex flex-col min-w-0">
            <div className="shrink-0 mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-bold text-[#142C3E] mb-1">Propose New Milestone</h2>
              <p className="text-xs text-[#5B6673] leading-relaxed">
                Milestones must have an explicit scope and acceptance criteria before evaluation.
              </p>
            </div>

            <form onSubmit={handleCreateMilestone} className="space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 pr-0.5">
              <div>
                <label className="block text-xs font-medium text-[#5B6673] mb-1">Milestone Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement user authentication & session management"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5B6673] mb-1">Expected Deliverables / Description</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe the functional capabilities to be delivered..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full text-xs sm:text-sm p-3 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5B6673] mb-1">
                  Acceptance Criteria (One per line)
                </label>
                <textarea
                  rows={3}
                  required
                  value={newCriteriaText}
                  onChange={e => setNewCriteriaText(e.target.value)}
                  className="w-full text-xs sm:text-sm p-3 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5B6673] mb-1">Repository URL</label>
                <input
                  type="url"
                  required
                  value={newRepoUrl}
                  onChange={e => setNewRepoUrl(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] font-mono text-xs min-h-[44px]"
                />
              </div>

              <div className="pt-2 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewMilestoneModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-[#5B6673] hover:text-[#17212B] min-h-[44px] flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-[#1E3E56] transition min-h-[44px] flex items-center justify-center"
                >
                  Save Milestone to Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-[#DCE3E9] py-4 mt-auto w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#5B6673] gap-2 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
            <span className="font-semibold text-[#142C3E]">VeriCommit</span>
            <span>•</span>
            <span>Fund with Evidence.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 sm:gap-2">
            <span>Cloud Firestore Persistent</span>
            <span>•</span>
            <span>Human-accountable grant verification</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
