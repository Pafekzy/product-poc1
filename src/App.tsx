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
  Database,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { FeatureCarousel } from './components/FeatureCarousel';
import { BrandedDropdown } from './components/BrandedDropdown';
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
  subscribeFundingAgreement,
  subscribeEvaluations,
  getEvaluationFromFirestore,
  saveMilestoneToFirestore,
  saveDecisionToFirestore,
  saveEvaluationToFirestore,
  subscribeAuditLogs,
  logAuditEventToFirestore,
  fetchAuthorizedAgreements,
  initializeDatabase
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
  const [availableAgreements, setAvailableAgreements] = useState<FundingAgreement[]>(initialFundingAgreements);
  const [selectedAgreementId, setSelectedAgreementId] = useState<string>('fa-8041');
  const [currentAgreement, setCurrentAgreement] = useState<FundingAgreement>(initialFundingAgreements[0]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('ms-01');
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationReport>>(sampleEvaluationReports);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialAuditLogs);
  const [agreementsLoading, setAgreementsLoading] = useState<boolean>(false);

  // Authentication & Connection state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Active Agreement Ref to prevent stale async responses from overwriting newly selected agreement
  const activeAgreementIdRef = useRef<string>('fa-8041');
  useEffect(() => {
    activeAgreementIdRef.current = selectedAgreementId;
  }, [selectedAgreementId]);

  // Dynamically compute caller's role on the selected agreement from cryptographic auth identity
  const userRole: 'Grantor' | 'Grantee' | 'Observer' = (() => {
    if (!currentUser) return 'Observer';
    const emailVerified = currentUser.emailVerified;
    const userEmail = currentUser.email?.trim().toLowerCase();
    const grantorEmail = currentAgreement.grantorEmail?.trim().toLowerCase();
    const granteeEmail = currentAgreement.granteeEmail?.trim().toLowerCase();

    // Recognize authenticated demo user as Grantor on designated demo agreement fa-8041
    const isDesignatedDemoGrantor = Boolean(
      currentAgreement.id === 'fa-8041' &&
      emailVerified &&
      userEmail &&
      (userEmail === 'pafekzy@gmail.com' || userEmail === 'imaginright.dev@gmail.com')
    );

    if (
      currentAgreement.grantorId === currentUser.uid ||
      Boolean(emailVerified && grantorEmail && userEmail && grantorEmail === userEmail) ||
      isDesignatedDemoGrantor
    ) {
      return 'Grantor';
    }
    if (
      currentAgreement.granteeId === currentUser.uid ||
      Boolean(emailVerified && granteeEmail && userEmail && granteeEmail === userEmail)
    ) {
      return 'Grantee';
    }
    return 'Observer';
  })();

  // Modal & Async states
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluatingMilestoneId, setEvaluatingMilestoneId] = useState<string | null>(null);
  const [evalStage, setEvalStage] = useState<'idle' | 'retrieving' | 'evaluating'>('idle');
  const [evalNotice, setEvalNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Review Form state
  const [reviewerName, setReviewerName] = useState<string>('Elena Vance');
  const [decisionChoice, setDecisionChoice] = useState<'approved' | 'rejected' | 'changes_requested'>('approved');
  const [decisionReasoning, setDecisionReasoning] = useState<string>('');
  const [decisionFeedback, setDecisionFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);

  // Create Milestone Modal state
  const [showNewMilestoneModal, setShowNewMilestoneModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCriteriaText, setNewCriteriaText] = useState('1. Implementation of core components\n2. Validation errors handled correctly\n3. Integration tests demonstrate functionality');
  const [newRepoUrl, setNewRepoUrl] = useState('https://github.com/example/community-tools');

  // Evidence Explorer State (Prompt 06)
  const [evidenceViewMode, setEvidenceViewMode] = useState<'sample' | 'live'>('sample');
  const [liveEvidence, setLiveEvidence] = useState<any | null>(null);
  const [isFetchingEvidence, setIsFetchingEvidence] = useState<boolean>(false);
  const [evidenceNotice, setEvidenceNotice] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  const handleSelectAgreement = (newAgreementId: string, customList?: FundingAgreement[]) => {
    const listToSearch = customList || availableAgreements;
    const target = listToSearch.find(a => a.id === newAgreementId);
    if (!target) return;

    activeAgreementIdRef.current = newAgreementId;
    setSelectedAgreementId(newAgreementId);
    setCurrentAgreement(target);

    // Requirement 4: Reset selected milestone, stale evaluations, review feedback, and agreement-specific UI state
    setSelectedMilestoneId(target.milestones[0]?.id || '');
    setDecisionFeedback(null);
    setDecisionReasoning('');
    setEvalNotice(null);
    setEvidenceNotice(null);
    setLiveEvidence(null);
    setEvidenceViewMode('sample');
    setIsEvaluating(false);
    setEvaluatingMilestoneId(null);
  };

  const handleFetchLiveEvidence = async () => {
    const targetAgreementId = currentAgreement.id;
    setIsFetchingEvidence(true);
    setEvidenceNotice(null);

    // Require authenticated session
    if (!currentUser) {
      setIsFetchingEvidence(false);
      setEvidenceNotice({
        type: 'error',
        message: 'Authentication required. In accordance with VeriCommit security rules, please sign in with Google in the header before fetching live repository evidence.'
      });
      return;
    }

    try {
      const idToken = await currentUser.getIdToken();
      const repoUrl = currentMilestone.repositoryUrl || 'https://github.com/Pafekzy/product-poc1';
      const queryParams = new URLSearchParams({
        repo_url: repoUrl,
        agreement_id: targetAgreementId
      });

      const res = await fetch(`/api/v1/evidence/github?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });

      const data = await res.json();

      // Guard against stale asynchronous responses
      if (activeAgreementIdRef.current !== targetAgreementId) {
        return;
      }

      if (!res.ok) {
        setEvidenceNotice({
          type: 'error',
          message: data.error?.message || `Failed to retrieve evidence (HTTP ${res.status}).`
        });
        setIsFetchingEvidence(false);
        return;
      }

      setLiveEvidence(data);
      setEvidenceViewMode('live');
      setEvidenceNotice({
        type: 'success',
        message: `Successfully retrieved live evidence from ${data.repository?.owner}/${data.repository?.repo} (${data.totalCommits} commits, ${data.totalPullRequests} pull requests).`
      });
    } catch (err: any) {
      if (activeAgreementIdRef.current === targetAgreementId) {
        setEvidenceNotice({
          type: 'error',
          message: err.message || 'Network error retrieving GitHub evidence.'
        });
      }
    } finally {
      if (activeAgreementIdRef.current === targetAgreementId) {
        setIsFetchingEvidence(false);
      }
    }
  };

  // Initialize DB and subscribe to Firebase Auth
  useEffect(() => {
    testFirestoreConnection().then(connected => {
      setDbConnected(connected);
    });

    const unsubAuth = subscribeToAuth(user => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user?.displayName) {
        setReviewerName(user.displayName);
      }
      if (user) {
        initializeDatabase().catch(err => {
          console.warn('Database initialization warning:', err);
        });
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Dynamically subscribe to the active funding agreement, evaluations, and audit logs
  useEffect(() => {
    // Only subscribe to Firestore when DB is connected and caller is authenticated
    if (!dbConnected || !currentUser) return;

    const unsubAgreement = subscribeFundingAgreement(
      selectedAgreementId,
      updatedAgreement => {
        // Prevent stale async callback if user switched agreements
        if (activeAgreementIdRef.current !== selectedAgreementId) return;
        if (updatedAgreement) {
          setCurrentAgreement(updatedAgreement);
          setAvailableAgreements(prev =>
            prev.map(a => a.id === updatedAgreement.id ? updatedAgreement : a)
          );
        }
      },
      err => {
        console.warn(`Firestore agreement subscription warning for ${selectedAgreementId}:`, err);
      }
    );

    const unsubEvaluations = subscribeEvaluations(
      savedEvals => {
        if (activeAgreementIdRef.current !== selectedAgreementId) return;
        if (savedEvals && Object.keys(savedEvals).length > 0) {
          setEvaluations(prev => ({ ...prev, ...savedEvals }));
        }
      },
      selectedAgreementId,
      err => {
        console.warn(`Firestore evaluations subscription warning for ${selectedAgreementId}:`, err);
      }
    );

    const unsubAudit = subscribeAuditLogs(
      logs => {
        if (activeAgreementIdRef.current !== selectedAgreementId) return;
        if (logs && logs.length > 0) {
          setAuditLogs(logs);
        }
      },
      selectedAgreementId,
      err => {
        console.warn(`Firestore audit logs subscription warning for ${selectedAgreementId}:`, err);
      }
    );

    return () => {
      unsubAgreement();
      unsubEvaluations();
      unsubAudit();
    };
  }, [selectedAgreementId, dbConnected, currentUser]);

  // Load authorized agreements when authenticated user changes
  useEffect(() => {
    if (!currentUser) {
      setAvailableAgreements(initialFundingAgreements);
      return;
    }

    setAgreementsLoading(true);
    currentUser.getIdToken().then(async idToken => {
      try {
        const authorized = await fetchAuthorizedAgreements(idToken);
        if (authorized && authorized.length > 0) {
          setAvailableAgreements(authorized);
          if (!authorized.some(a => a.id === activeAgreementIdRef.current)) {
            handleSelectAgreement(authorized[0].id, authorized);
          }
        }
      } catch (err: any) {
        console.warn('Could not fetch authorized agreements:', err);
      } finally {
        setAgreementsLoading(false);
      }
    }).catch(err => {
      console.warn('Token error:', err);
      setAgreementsLoading(false);
    });
  }, [currentUser]);

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

  // Fallback direct retrieval of milestone evaluation report from Cloud Firestore if not yet in state
  useEffect(() => {
    if (currentMilestone?.evaluationId && !evaluations[currentMilestone.evaluationId] && dbConnected && currentUser) {
      getEvaluationFromFirestore(currentMilestone.evaluationId)
        .then(savedReport => {
          if (savedReport) {
            setEvaluations(prev => ({ ...prev, [savedReport.evaluation_id]: savedReport }));
          }
        })
        .catch(err => {
          console.warn('Evaluation direct fetch deferred:', err);
        });
    }
  }, [currentMilestone?.evaluationId, evaluations, dbConnected, currentUser]);

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
    const targetAgreementId = currentAgreement.id;

    // 1. Validate that the milestone and its acceptance criteria exist
    if (!milestone) {
      setEvalNotice({
        type: 'error',
        message: 'No milestone selected for evaluation.'
      });
      return;
    }

    if (!milestone.acceptanceCriteria || milestone.acceptanceCriteria.length === 0) {
      setEvalNotice({
        type: 'error',
        message: `Milestone "${milestone.title}" has no agreed acceptance criteria defined. AI evaluation requires clear, verifiable criteria.`
      });
      return;
    }

    if (!currentUser) {
      setEvalNotice({
        type: 'error',
        message: 'Authentication required. In accordance with VeriCommit security rules, please sign in with Google in the header before running milestone evaluations.'
      });
      return;
    }

    setIsEvaluating(true);
    setEvaluatingMilestoneId(milestone.id);
    const initialStage = milestone.evidenceSource === 'github' ? 'retrieving' : 'evaluating';
    setEvalStage(initialStage);
    setEvalNotice(null);
    setSelectedMilestoneId(milestone.id);

    let stageTimer: any = null;
    if (milestone.evidenceSource === 'github') {
      // Progress from repository evidence retrieval to Gemini evaluation
      stageTimer = setTimeout(() => {
        setEvalStage('evaluating');
      }, 1000);
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        } catch {
          // Token retrieval optional
        }
      }

      const apiRes = await fetch('/api/v1/evaluations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          project_name: currentAgreement.title,
          agreement_id: targetAgreementId,
          milestone_id: milestone.id,
          repository_url: milestone.repositoryUrl || 'https://github.com/example/community-tools',
          milestone: {
            id: milestone.id,
            title: milestone.title,
            description: milestone.description,
            acceptance_criteria: milestone.acceptanceCriteria.map(c => c.description)
          },
          evidence_source: milestone.evidenceSource
        })
      });

      if (!apiRes.ok) {
        const errorData = await apiRes.json().catch(() => ({}));
        const codeMsg = errorData.error?.code ? `[${errorData.error.code}] ` : '';
        throw new Error(`${codeMsg}${errorData.error?.message || `Evaluation request failed with HTTP ${apiRes.status}`}`);
      }

      const newEvaluation: EvaluationReport = await apiRes.json();

      // Guard against stale asynchronous responses
      if (activeAgreementIdRef.current !== targetAgreementId) {
        return;
      }

      setEvaluations(prev => ({ ...prev, [newEvaluation.evaluation_id]: newEvaluation }));

      let firestorePersisted = false;
      try {
        await saveEvaluationToFirestore(currentAgreement.id, milestone.id, newEvaluation);
        firestorePersisted = true;
      } catch (fsErr) {
        console.warn('Evaluation persistence write deferred/failed:', fsErr);
      }

      // Update in-memory agreement milestone immediately
      setCurrentAgreement(prev => ({
        ...prev,
        milestones: prev.milestones.map(m =>
          m.id === milestone.id
            ? { ...m, evaluationId: newEvaluation.evaluation_id, updatedAt: new Date().toISOString() }
            : m
        )
      }));

      // Audit log entry
      const newAudit: AuditLogEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: currentUser ? `${currentUser.displayName || currentUser.email} (User)` : 'AI Evaluation Service (Assisted)',
        actor_uid: currentUser?.uid,
        action: 'Generated Evidence Assessment',
        entityType: 'Evaluation',
        entityId: newEvaluation.evaluation_id,
        agreementId: currentAgreement.id,
        milestoneId: milestone.id,
        details: `Assessed evidence for Milestone "${milestone.title}" using Gemini 3.8 Flash (${newEvaluation.evidence_source.toUpperCase()} evidence). ${firestorePersisted ? 'Findings persisted to Cloud Firestore.' : 'Local session evaluation.'}`
      };
      try {
        await logAuditEventToFirestore(newAudit);
      } catch (auditErr) {
        console.warn('Audit log write deferred:', auditErr);
      }

      setEvalNotice({
        type: 'success',
        message: `Evaluation completed successfully via Gemini 3.8 Flash against ${newEvaluation.evidence_source === 'github' ? 'live GitHub repository' : 'demonstration sample'} evidence. ${firestorePersisted ? 'Persisted to Cloud Firestore.' : 'Notice: Unauthenticated session — report stored in local memory only. Sign in to persist findings to Cloud Firestore.'}`
      });
      setActiveTab('verification-report');
    } catch (apiErr: any) {
      console.error('Evidence evaluation failed:', apiErr);
      setEvalNotice({
        type: 'error',
        message: `Evaluation failed: ${apiErr.message || 'Failed to complete evidence evaluation'}`
      });
    } finally {
      if (stageTimer) clearTimeout(stageTimer);
      setIsEvaluating(false);
      setEvaluatingMilestoneId(null);
      setEvalStage('idle');
    }
  };

  // Handle Recording Human Decision
  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDecision) return;

    if (!decisionReasoning.trim() || decisionReasoning.trim().length < 10) {
      setDecisionFeedback({
        type: 'error',
        message: 'Explicit justification and reasoning (minimum 10 characters) is required.'
      });
      return;
    }

    // Require authenticated session for consequential decision signing
    if (!currentUser) {
      setDecisionFeedback({
        type: 'error',
        message: 'Authentication required: In accordance with VeriCommit governance rules, only the authorized Grantor can sign milestone decisions. Please sign in with Google in the header.'
      });
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionFeedback(null);

    const targetAgreementId = currentAgreement.id;

    // 1. Server-side Authorization Check
    try {
      const idToken = await currentUser.getIdToken();
      const serverRes = await fetch('/api/v1/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          agreement_id: targetAgreementId,
          milestone_id: currentMilestone.id,
          evaluation_id: currentMilestone.evaluationId,
          status: decisionChoice,
          reasoning: decisionReasoning
        })
      });

      if (activeAgreementIdRef.current !== targetAgreementId) {
        return;
      }

      if (!serverRes.ok) {
        const errPayload = await serverRes.json().catch(() => ({}));
        setDecisionFeedback({
          type: 'error',
          message: `Server Authorization Denied: ${errPayload.error?.message || 'Only authorized Grantor may sign decisions.'}`
        });
        setIsSubmittingDecision(false);
        return;
      }
    } catch (networkErr: any) {
      if (activeAgreementIdRef.current === targetAgreementId) {
        setDecisionFeedback({
          type: 'error',
          message: `Authorization verification failed: ${networkErr.message || 'Network error'}.`
        });
        setIsSubmittingDecision(false);
      }
      return;
    }

    const newDecision: HumanDecision = {
      decision_id: `dec-${Date.now()}`,
      agreement_id: targetAgreementId,
      milestone_id: currentMilestone.id,
      evaluation_id: currentMilestone.evaluationId,
      reviewer_name: currentUser.displayName || reviewerName,
      reviewer_role: 'Grantor',
      reviewer_uid: currentUser.uid,
      reviewer_email: currentUser.email || undefined,
      status: decisionChoice,
      reasoning: decisionReasoning,
      recorded_at: new Date().toISOString()
    };

    let decisionPersisted = false;
    let auditPersisted = false;

    try {
      // 2. Persist to Cloud Firestore
      await saveDecisionToFirestore(targetAgreementId, currentMilestone.id, newDecision);
      decisionPersisted = true;

      // 3. Audit log
      const audit: AuditLogEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: `${currentUser.displayName || reviewerName} (Grantor)`,
        actor_uid: currentUser.uid,
        action: `Recorded Human Decision: ${decisionChoice.toUpperCase()}`,
        entityType: 'HumanDecision',
        entityId: newDecision.decision_id,
        agreementId: targetAgreementId,
        milestoneId: currentMilestone.id,
        details: `Milestone "${currentMilestone.title}" decision: ${decisionChoice}. Reason: "${decisionReasoning}"`
      };

      try {
        await logAuditEventToFirestore(audit);
        auditPersisted = true;
      } catch (auditErr) {
        console.warn('Audit log write deferred:', auditErr);
      }

      if (activeAgreementIdRef.current !== targetAgreementId) {
        return;
      }

      // 4. Update local agreement milestone state
      setCurrentAgreement(prev => ({
        ...prev,
        milestones: prev.milestones.map(m =>
          m.id === currentMilestone.id
            ? { ...m, humanDecision: newDecision, updatedAt: new Date().toISOString() }
            : m
        )
      }));

      setDecisionFeedback({
        type: 'success',
        message: decisionPersisted && auditPersisted
          ? 'Decision successfully verified by server and recorded in Cloud Firestore with audit trail.'
          : 'Decision verified and recorded in Cloud Firestore (audit log entry recorded locally).'
      });
      setDecisionReasoning('');
    } catch (saveErr: any) {
      setDecisionFeedback({
        type: 'error',
        message: `Server approved decision, but Cloud Firestore write failed: ${saveErr.message || 'Permission denied'}.`
      });
    } finally {
      setIsSubmittingDecision(false);
    }
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
      actor_uid: currentUser?.uid,
      action: 'Created Milestone',
      entityType: 'Milestone',
      entityId: newMs.id,
      agreementId: currentAgreement.id,
      milestoneId: newMs.id,
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
    <div className="min-h-screen bg-[#F5F7F9] text-[#17212B] flex flex-col font-sans max-w-full">
      {/* Top Navigation Bar - Locked Navy Header (Fixed Viewport Navigation) */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#142C3E] text-white border-b border-[#22435D] shadow-md w-full">
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

      {/* Persistent Header Spacer to reserve vertical space for fixed header and prevent content occlusion */}
      <div className="h-[113px] shrink-0 w-full" aria-hidden="true" />

      {/* Main Content Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden relative z-10">
        {/* Agreement Selector & Scoped Role Bar */}
        <div className="mb-4 sm:mb-6 bg-white rounded-xl border border-[#DCE3E9] p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <FolderGit2 className="w-5 h-5 text-[#167D72] shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#5B6673]">Funding Agreement:</span>
            </div>
            <div className="flex-1 min-w-0 max-w-xl">
              <BrandedDropdown
                id="agreement-selector"
                value={selectedAgreementId}
                onChange={handleSelectAgreement}
                disabled={agreementsLoading}
                ariaLabel="Select Funding Agreement"
                dataTestId="agreement-selector"
                options={availableAgreements.map(ag => ({
                  value: ag.id,
                  label: `[${ag.id.toUpperCase()}] ${ag.title}`,
                  badge: ag.id.toUpperCase(),
                  secondaryText: `${ag.grantorName} • ${ag.granteeName} • ${ag.totalCommitment}`
                }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto flex-wrap">
            {/* Mode Indicator */}
            <span className={`text-[11px] font-mono font-medium px-2.5 py-1 rounded-md border ${
              currentUser
                ? 'bg-[#E6F4F2] text-[#167D72] border-[#A8DDD7]'
                : 'bg-[#EEF2F6] text-[#5B6673] border-[#DCE3E9]'
            }`}>
              {currentUser ? 'Authenticated Scope' : 'Demo Mode (Sample)'}
            </span>

            {/* Computed Role Badge */}
            <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
              userRole === 'Grantor'
                ? 'bg-[#E6F4F2] text-[#167D72] border-[#A8DDD7]'
                : userRole === 'Grantee'
                ? 'bg-[#EAF2F8] text-[#1E5F8B] border-[#BBD5E8]'
                : 'bg-[#FFF8E6] text-[#8C5E00] border-[#F2D696]'
            }`}>
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              Role: {userRole === 'Grantor' ? 'Grantor (Authorized Signer)' : userRole === 'Grantee' ? 'Grantee (Recipient)' : 'Observer'}
            </span>
          </div>
        </div>

        {/* Banner Alert on non-dashboard tabs if Human Review is Pending */}
        {activeTab !== 'dashboard' && activeTab !== 'human-review' && currentMilestone && !currentMilestone.humanDecision && currentMilestone.evaluationId && (
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
              className="w-full sm:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition shrink-0 min-h-[44px] text-center flex items-center justify-center cursor-pointer"
            >
              Review Milestone
            </button>
          </div>
        )}

        {/* In-Flight Evaluation Progress Banner */}
        {isEvaluating && (
          <div
            className="mb-4 sm:mb-6 p-4 rounded-xl text-xs sm:text-sm shadow-xs bg-[#EAF2F8] border border-[#BBD5E8] text-[#142C3E] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            data-testid="evaluation-progress-banner"
          >
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <Loader2 className="w-5 h-5 text-[#167D72] animate-spin shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="font-semibold text-[#142C3E]">
                  {evalStage === 'retrieving'
                    ? 'Retrieving repository evidence...'
                    : 'Gemini is evaluating the milestone against acceptance criteria...'}
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

        {/* Prominent Evaluation Notice (Success or Explicit Error) */}
        {evalNotice && activeTab !== 'verification-report' && (
          <div
            className={`mb-4 sm:mb-6 p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 shadow-xs ${
              evalNotice.type === 'error'
                ? 'bg-[#FDF3F2] border border-[#F5C2C0] text-[#9A2D2B]'
                : 'bg-[#E6F4F2] border border-[#A8DDD7] text-[#167D72]'
            }`}
            data-testid="evaluation-notice-banner"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {evalNotice.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-[#9A2D2B] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-[#167D72] shrink-0 mt-0.5" />
              )}
              <span className="break-words font-medium">{evalNotice.message}</span>
            </div>
            <button
              onClick={() => setEvalNotice(null)}
              className="text-xs font-bold underline shrink-0 min-h-[44px] px-2 flex items-center cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: WORKSPACE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 sm:space-y-6">
            {/* 1. Product Capability Showcase (ordered above Human Decision Required and Agreement details) */}
            <FeatureCarousel />

            {/* 2. Banner Alert if Human Review is Pending */}
            {currentMilestone && !currentMilestone.humanDecision && currentMilestone.evaluationId && (
              <div className="p-3.5 sm:p-4 bg-[#FFF1D6] border border-[#F2D696] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs" data-testid="dashboard-human-decision-banner">
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
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] transition shrink-0 min-h-[44px] text-center flex items-center justify-center cursor-pointer"
                >
                  Review Milestone
                </button>
              </div>
            )}

            {/* 3. Active Funding Agreement Details (Agreement Header Card) */}
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
                              className="flex-1 sm:flex-none px-3 py-2.5 text-xs font-medium text-white bg-[#142C3E] hover:bg-[#1E3E56] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs min-h-[44px]"
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
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
                >
                  {isEvaluating && evaluatingMilestoneId === currentMilestone.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#167D72] shrink-0" />
                      <span>{evalStage === 'retrieving' ? 'Retrieving repository evidence...' : 'Gemini is evaluating milestone...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#167D72] shrink-0" />
                      <span>Run AI-Assisted Evaluation</span>
                    </>
                  )}
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
            {/* Header & Source Provenance Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono uppercase text-[#167D72] font-semibold">Traceable Artifacts</span>
                  <span className="text-xs text-[#5B6673] font-mono truncate max-w-xs sm:max-w-md">
                    {currentMilestone.repositoryUrl || 'https://github.com/Pafekzy/product-poc1'}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] break-words">Evidence Explorer</h1>
                <p className="text-xs text-[#5B6673] mt-1 break-words">
                  Examine commits, pull requests, and verified evidence associated with <strong>{currentMilestone.title}</strong>.
                </p>
              </div>

              {/* Provenance Badge & Mode Switcher */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0 ${
                    evidenceViewMode === 'live'
                      ? 'bg-[#E6F4F2] text-[#167D72] border-[#A8DDD7]'
                      : 'bg-[#FFF1D6] text-[#8C5E00] border-[#F2D696]'
                  }`}
                  data-testid="evidence-source-badge"
                >
                  {evidenceViewMode === 'live' ? 'Source: Live GitHub API' : 'Source: Sample Dataset'}
                </div>
              </div>
            </div>

            {/* Action Bar: Fetch Live Button & Dataset Mode Toggles */}
            <div className="bg-white rounded-xl border border-[#DCE3E9] p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFetchLiveEvidence}
                  disabled={isFetchingEvidence}
                  data-testid="fetch-live-evidence-btn"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] disabled:opacity-50 transition shadow-xs min-h-[44px] cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetchingEvidence ? 'animate-spin' : ''}`} />
                  {isFetchingEvidence ? 'Retrieving from GitHub...' : 'Fetch Live GitHub Evidence'}
                </button>

                {liveEvidence && (
                  <div className="flex items-center rounded-lg border border-[#DCE3E9] p-0.5 bg-[#F5F7F9]">
                    <button
                      type="button"
                      onClick={() => setEvidenceViewMode('live')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                        evidenceViewMode === 'live'
                          ? 'bg-white text-[#142C3E] shadow-2xs font-bold'
                          : 'text-[#5B6673] hover:text-[#142C3E]'
                      }`}
                    >
                      Live
                    </button>
                    <button
                      type="button"
                      onClick={() => setEvidenceViewMode('sample')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
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
                  <span>Authenticated as <strong className="text-[#142C3E]">{currentUser.email || currentUser.displayName}</strong></span>
                ) : (
                  <span className="text-[#8C5E00]">Sign in above to enable live repository retrieval</span>
                )}
              </div>
            </div>

            {/* Notification Banner */}
            {evidenceNotice && (
              <div
                className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 ${
                  evidenceNotice.type === 'error'
                    ? 'bg-[#FDF3F2] border border-[#F5C2C0] text-[#9A2D2B]'
                    : evidenceNotice.type === 'success'
                    ? 'bg-[#E6F4F2] border border-[#A8DDD7] text-[#167D72]'
                    : 'bg-[#EEF2F6] border border-[#DCE3E9] text-[#142C3E]'
                }`}
                data-testid="evidence-notice-banner"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{evidenceNotice.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEvidenceNotice(null)}
                  className="text-xs font-bold underline shrink-0 min-h-[44px] px-2 flex items-center"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Invariant Disclaimer Strip */}
            <div className="p-3 bg-[#FFF9EE] border border-[#F2E5CB] rounded-lg text-xs text-[#5A2D0C] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C88D3A] shrink-0 mt-0.5" />
              <span>
                <strong>Evidence Provenance Rule:</strong> Repository activity alone does not prove completion, originality, or production stability. Retrieved artifacts are untrusted evidence to support human evaluation.
              </span>
            </div>

            {/* LIVE EVIDENCE VIEW */}
            {evidenceViewMode === 'live' && liveEvidence && (
              <div className="space-y-4 sm:space-y-6" data-testid="live-evidence-view">
                {/* Pull Requests Section */}
                <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h2 className="text-base font-bold text-[#142C3E] flex items-center gap-2">
                      <GitPullRequest className="w-4 h-4 text-[#167D72] shrink-0" />
                      Pull Requests & Branches (Live from GitHub)
                    </h2>
                    <span className="text-xs font-mono font-semibold text-[#167D72] bg-[#E6F4F2] px-2 py-0.5 rounded">
                      {liveEvidence.pullRequests.length} Retrieved
                    </span>
                  </div>

                  {liveEvidence.pullRequests.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#5B6673] bg-[#F5F7F9] rounded-lg border border-[#DCE3E9]">
                      No pull requests returned from {liveEvidence.repository.owner}/{liveEvidence.repository.repo}.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {liveEvidence.pullRequests.map((pr: any) => (
                        <div
                          key={pr.id}
                          className="p-3.5 sm:p-4 rounded-lg border border-[#DCE3E9] bg-white hover:bg-gray-50 transition flex flex-col md:flex-row md:items-start justify-between gap-3 min-w-0"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs bg-[#E6F4F2] text-[#167D72] px-2 py-0.5 rounded font-semibold">
                                #{pr.number}
                              </span>
                              <h3 className="text-sm font-semibold text-[#142C3E] break-words">{pr.title}</h3>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                                  pr.state === 'merged'
                                    ? 'bg-green-100 text-green-800'
                                    : pr.state === 'open'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {pr.state}
                              </span>
                              <span className="text-[10px] bg-[#E6F4F2] text-[#167D72] px-1.5 py-0.5 rounded font-mono font-bold">
                                LIVE
                              </span>
                            </div>
                            <div className="font-mono text-[11px] text-[#7D94A6] break-words">
                              {pr.headBranch && pr.baseBranch ? (
                                <>
                                  Branch: <span className="text-[#142C3E]">{pr.headBranch}</span> → <span>{pr.baseBranch}</span> • Author:{' '}
                                </>
                              ) : null}
                              <span className="text-[#142C3E]">{pr.author}</span> •{' '}
                              <span>{new Date(pr.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#167D72] hover:underline font-medium flex items-center gap-1 font-mono break-all shrink-0 min-h-[44px]"
                          >
                            <span>View on GitHub</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Commits Section */}
                <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h2 className="text-base font-bold text-[#142C3E] flex items-center gap-2">
                      <GitCommit className="w-4 h-4 text-[#167D72] shrink-0" />
                      Recent Verified Commits (Live from GitHub)
                    </h2>
                    <span className="text-xs font-mono font-semibold text-[#167D72] bg-[#E6F4F2] px-2 py-0.5 rounded">
                      {liveEvidence.commits.length} Retrieved
                    </span>
                  </div>

                  {liveEvidence.commits.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#5B6673] bg-[#F5F7F9] rounded-lg border border-[#DCE3E9]">
                      No recent commits returned for this repository.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {liveEvidence.commits.map((c: any) => (
                        <div
                          key={c.id}
                          className="p-3 rounded border border-[#DCE3E9] flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs min-w-0 hover:bg-gray-50 transition"
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className="font-mono bg-[#EEF2F6] text-[#142C3E] px-2 py-0.5 rounded font-bold shrink-0 mt-0.5">
                              {c.shortSha}
                            </span>
                            <div className="min-w-0">
                              <span className="font-medium text-[#17212B] break-words">{c.title}</span>
                              <div className="text-[11px] text-[#5B6673] font-mono mt-0.5">
                                Author: <span className="text-[#142C3E]">{c.author}</span> •{' '}
                                {new Date(c.committedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#167D72] hover:underline flex items-center gap-1 font-mono text-[11px] shrink-0 pt-1 sm:pt-0 self-start sm:self-auto min-h-[44px]"
                          >
                            <span>Commit diff</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SAMPLE EVIDENCE VIEW */}
            {evidenceViewMode === 'sample' && (
              <div className="space-y-4 sm:space-y-6" data-testid="sample-evidence-view">
                <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
                  <h2 className="text-base font-bold text-[#142C3E] mb-3 sm:mb-4 flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-[#167D72] shrink-0" />
                    Pull Requests & Branches (Sample Dataset)
                  </h2>
                  <div className="space-y-3">
                    <div className="p-3.5 sm:p-4 rounded-lg border border-[#DCE3E9] bg-white hover:bg-gray-50 transition flex flex-col md:flex-row md:items-start justify-between gap-3 min-w-0">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs bg-[#E6F4F2] text-[#167D72] px-2 py-0.5 rounded font-semibold">#12</span>
                          <h3 className="text-sm font-semibold text-[#142C3E] break-words">Add member registration form and confirmation dialog</h3>
                          <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-mono font-bold">MERGED</span>
                          <span className="text-[10px] bg-[#FFF1D6] text-[#8C5E00] px-1.5 py-0.5 rounded font-mono font-bold">SAMPLE</span>
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
                          <span className="text-[10px] bg-[#FFF1D6] text-[#8C5E00] px-1.5 py-0.5 rounded font-mono font-bold">SAMPLE</span>
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
                    Recent Verified Commits (Sample Dataset)
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
          </div>
        )}

        {/* TAB 4: VERIFICATION REPORT */}
        {activeTab === 'verification-report' && (
          <div className="space-y-4 sm:space-y-6">
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
                        : 'Gemini is evaluating the milestone against acceptance criteria...'}
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

            {evalNotice && (
              <div
                className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 shadow-xs ${
                  evalNotice.type === 'error'
                    ? 'bg-[#FDF3F2] border border-[#F5C2C0] text-[#9A2D2B]'
                    : 'bg-[#E6F4F2] border border-[#A8DDD7] text-[#167D72]'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {evalNotice.type === 'error' ? (
                    <AlertTriangle className="w-5 h-5 text-[#9A2D2B] shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-[#167D72] shrink-0 mt-0.5" />
                  )}
                  <span className="break-words font-medium">{evalNotice.message}</span>
                </div>
                <button
                  onClick={() => setEvalNotice(null)}
                  className="text-xs font-bold underline shrink-0 min-h-[44px] px-2 flex items-center cursor-pointer"
                >
                  Dismiss
                </button>
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
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#142C3E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#1E3E56] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 min-h-[44px] mx-auto"
                >
                  {isEvaluating && evaluatingMilestoneId === currentMilestone.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#167D72] shrink-0" />
                      <span>{evalStage === 'retrieving' ? 'Retrieving repository evidence...' : 'Gemini is evaluating milestone...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#167D72] shrink-0" />
                      <span>Run Evidence Evaluation</span>
                    </>
                  )}
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
                          AI-Assisted Assessment (Gemini 3.8 Flash)
                        </span>
                        <span className="text-xs font-semibold bg-[#FEF3D6] text-[#8C5E00] border border-[#F3DE9D] px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-[#8C5E00]" />
                          Human Review Required: {currentEvaluation.human_review_required ? 'Yes (Enforced)' : 'No'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                          currentEvaluation.evidence_source === 'github'
                            ? 'bg-[#E6F4F2] text-[#167D72] border border-[#A8DDD7]'
                            : 'bg-[#F0F4F8] text-[#5B6673] border border-[#DCE3E9]'
                        }`}>
                          {currentEvaluation.evidence_source === 'github' ? 'Live GitHub Evidence' : 'Sample Demonstration Evidence'}
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[#142C3E] mt-2 break-words">{currentEvaluation.milestone_title}</h1>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5B6673] mt-1">
                        <span>Project: {currentEvaluation.project_name}</span>
                        <span>•</span>
                        <span>Evaluated: {new Date(currentEvaluation.evaluated_at).toLocaleString()}</span>
                        <span>•</span>
                        <span className="font-mono">Engine: Gemini 3.8 Flash (Server-Side)</span>
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
              <div className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 border ${
                decisionFeedback.type === 'error'
                  ? 'bg-[#FDF2F2] border-[#F8B4B4] text-[#9B1C1C]'
                  : 'bg-[#E6F4F2] border-[#A8DDD7] text-[#167D72]'
              }`}>
                <span className="break-words font-medium">{decisionFeedback.message}</span>
                <button
                  onClick={() => setDecisionFeedback(null)}
                  className="text-xs font-bold underline shrink-0 min-h-[44px] px-2 flex items-center"
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

            {/* Decision Submission Form */}
            <div className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
              <h2 className="text-base font-bold text-[#142C3E] mb-3 sm:mb-4 break-words">
                Record Review Decision for "{currentMilestone.title}"
              </h2>

              {userRole === 'Grantee' && (
                <div className="mb-4 p-3.5 sm:p-4 rounded-xl bg-[#FFF8E6] border border-[#F2D696] text-[#8C5E00] flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm">
                    <strong>Action Restricted to Grantor:</strong> You are participating as the <strong>Grantee</strong> on Funding Agreement <strong>{currentAgreement.id}</strong>. In accordance with VeriCommit authorization rules, only the designated Grantor may record and sign official milestone verification decisions.
                  </div>
                </div>
              )}

              <form onSubmit={handleRecordDecision} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#5B6673] mb-1">
                      Reviewer Identity
                    </label>
                    <input
                      type="text"
                      value={reviewerName}
                      disabled={isSubmittingDecision || userRole === 'Grantee'}
                      onChange={e => setReviewerName(e.target.value)}
                      required
                      className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] disabled:bg-gray-100 min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5B6673] mb-1">
                      Verified Role for this Agreement
                    </label>
                    <div className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-[#DCE3E9] bg-[#F5F7F9] flex items-center gap-2 min-h-[44px]">
                      <UserCheck className="w-4 h-4 text-[#167D72] shrink-0" />
                      <span className="font-semibold text-[#142C3E]">
                        {userRole === 'Grantor'
                          ? 'Grantor (Authorized Signer)'
                          : userRole === 'Grantee'
                          ? 'Grantee (Unauthorized for Signatures)'
                          : 'Observer (Demo Mode)'}
                      </span>
                    </div>
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
                        disabled={isSubmittingDecision}
                        onClick={() => setDecisionChoice(opt.val as any)}
                        className={`p-3 rounded-lg border text-left transition min-h-[48px] flex flex-col justify-center disabled:opacity-60 ${
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
                    disabled={isSubmittingDecision}
                    onChange={e => setDecisionReasoning(e.target.value)}
                    required
                    placeholder="Describe how the available evidence supports or fails to support the acceptance criteria, and detail any reviewer verifications conducted..."
                    className="w-full text-xs sm:text-sm p-3 rounded-lg border border-[#DCE3E9] focus:outline-none focus:border-[#142C3E] disabled:bg-gray-100 leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingDecision || userRole === 'Grantee'}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#142C3E] disabled:bg-gray-400 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-[#1E3E56] transition shadow-xs flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <UserCheck className="w-4 h-4 text-[#167D72]" />
                    {userRole === 'Grantee'
                      ? 'Decision Restricted to Grantor'
                      : isSubmittingDecision
                      ? 'Verifying & Recording...'
                      : 'Record & Sign Decision'}
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
