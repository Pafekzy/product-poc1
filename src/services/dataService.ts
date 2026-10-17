import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
  onAuthStateChanged
} from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  FundingAgreement,
  Milestone,
  EvaluationReport,
  HumanDecision,
  AuditLogEntry
} from '../types';
import { initialFundingAgreements, sampleEvaluationReports, initialAuditLogs } from '../data/mockData';

// 1. Connection Healthcheck
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore is currently offline or unreachable.');
      return false;
    }
    // Expected if doc doesn't exist, but server responded
    return true;
  }
}

// 2. Authentication Helpers
export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (error) {
    console.error('Google Sign-in Error:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// 3. Persistent Data Operations
export async function initializeDatabase(): Promise<void> {
  const agreementRef = doc(db, 'funding_agreements', 'fa-8041');
  try {
    const snap = await getDoc(agreementRef);
    if (!snap.exists()) {
      // Seed initial agreement
      const seed = initialFundingAgreements[0];
      await setDoc(agreementRef, {
        id: seed.id,
        title: seed.title,
        grantorId: seed.grantorId,
        grantorName: seed.grantorName,
        grantorEmail: seed.grantorEmail || 'imaginright.dev@gmail.com',
        granteeId: seed.granteeId,
        granteeName: seed.granteeName,
        granteeEmail: seed.granteeEmail || 'grantee@example.com',
        description: seed.description,
        totalCommitment: seed.totalCommitment,
        status: seed.status,
        createdAt: seed.createdAt
      });

      // Seed milestones
      for (const ms of seed.milestones) {
        const msRef = doc(db, 'funding_agreements', 'fa-8041', 'milestones', ms.id);
        await setDoc(msRef, ms);
      }

      // Seed initial evaluations
      for (const [evalId, report] of Object.entries(sampleEvaluationReports)) {
        await setDoc(doc(db, 'evaluations', evalId), report);
      }

      // Seed initial audit logs
      for (const log of initialAuditLogs) {
        await setDoc(doc(db, 'audit_logs', log.id), log);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'funding_agreements/fa-8041');
  }
}

export function subscribeFundingAgreement(
  agreementId: string,
  onAgreementUpdate: (agreement: FundingAgreement) => void
) {
  const agreementRef = doc(db, 'funding_agreements', agreementId);
  const milestonesCol = collection(db, 'funding_agreements', agreementId, 'milestones');

  let currentAgreementData: any = null;
  let currentMilestones: Milestone[] = [];

  const updateCombined = () => {
    if (currentAgreementData) {
      onAgreementUpdate({
        ...currentAgreementData,
        milestones: currentMilestones
      });
    }
  };

  const unsubAgreement = onSnapshot(
    agreementRef,
    docSnap => {
      if (docSnap.exists()) {
        currentAgreementData = docSnap.data();
        updateCombined();
      }
    },
    err => handleFirestoreError(err, OperationType.GET, `funding_agreements/${agreementId}`)
  );

  const unsubMilestones = onSnapshot(
    milestonesCol,
    snapshot => {
      currentMilestones = snapshot.docs.map(d => d.data() as Milestone);
      updateCombined();
    },
    err => handleFirestoreError(err, OperationType.LIST, `funding_agreements/${agreementId}/milestones`)
  );

  return () => {
    unsubAgreement();
    unsubMilestones();
  };
}

export function subscribeEvaluations(onUpdate: (evals: Record<string, EvaluationReport>) => void) {
  const colRef = collection(db, 'evaluations');
  return onSnapshot(
    colRef,
    snapshot => {
      const reports: Record<string, EvaluationReport> = {};
      snapshot.docs.forEach(docSnap => {
        reports[docSnap.id] = docSnap.data() as EvaluationReport;
      });
      onUpdate(reports);
    },
    err => handleFirestoreError(err, OperationType.LIST, 'evaluations')
  );
}

export async function getEvaluationFromFirestore(evaluationId: string): Promise<EvaluationReport | null> {
  const evalRef = doc(db, 'evaluations', evaluationId);
  try {
    const snap = await getDoc(evalRef);
    if (snap.exists()) {
      return snap.data() as EvaluationReport;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `evaluations/${evaluationId}`);
  }
}

export async function saveMilestoneToFirestore(agreementId: string, milestone: Milestone): Promise<void> {
  const msRef = doc(db, 'funding_agreements', agreementId, 'milestones', milestone.id);
  try {
    await setDoc(msRef, milestone);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `funding_agreements/${agreementId}/milestones/${milestone.id}`);
  }
}

export async function saveDecisionToFirestore(
  agreementId: string,
  milestoneId: string,
  decision: HumanDecision
): Promise<void> {
  const decisionRef = doc(db, 'human_decisions', decision.decision_id);
  const milestoneRef = doc(db, 'funding_agreements', agreementId, 'milestones', milestoneId);

  try {
    await setDoc(decisionRef, decision);
    const msSnap = await getDoc(milestoneRef);
    if (msSnap.exists()) {
      const msData = msSnap.data() as Milestone;
      await setDoc(milestoneRef, {
        ...msData,
        humanDecision: decision,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `human_decisions/${decision.decision_id}`);
  }
}

export async function saveEvaluationToFirestore(
  agreementId: string,
  milestoneId: string,
  evaluation: EvaluationReport
): Promise<void> {
  const evalRef = doc(db, 'evaluations', evaluation.evaluation_id);
  const milestoneRef = doc(db, 'funding_agreements', agreementId, 'milestones', milestoneId);

  try {
    await setDoc(evalRef, evaluation);
    const msSnap = await getDoc(milestoneRef);
    if (msSnap.exists()) {
      const msData = msSnap.data() as Milestone;
      await setDoc(milestoneRef, {
        ...msData,
        evaluationId: evaluation.evaluation_id,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `evaluations/${evaluation.evaluation_id}`);
  }
}

export function subscribeAuditLogs(onUpdate: (logs: AuditLogEntry[]) => void) {
  const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    snapshot => {
      const items = snapshot.docs.map(d => d.data() as AuditLogEntry);
      onUpdate(items);
    },
    err => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
  );
}

export async function logAuditEventToFirestore(entry: AuditLogEntry): Promise<void> {
  const logRef = doc(db, 'audit_logs', entry.id);
  try {
    await setDoc(logRef, entry);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${entry.id}`);
  }
}
