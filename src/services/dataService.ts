import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  where,
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

export async function initializeDatabase(): Promise<void> {
  try {
    const currentEmail = auth.currentUser?.email?.trim().toLowerCase();
    const currentUid = auth.currentUser?.uid;
    const isEmailVerified = Boolean(auth.currentUser?.emailVerified);

    for (const seed of initialFundingAgreements) {
      const agreementRef = doc(db, 'funding_agreements', seed.id);
      const snap = await getDoc(agreementRef);
      if (!snap.exists()) {
        const isDemoGrantor = seed.id === 'fa-8041' && isEmailVerified && currentEmail === 'pafekzy@gmail.com';
        const grantorEmail = isDemoGrantor && currentEmail ? currentEmail : seed.grantorEmail;
        const grantorId = isDemoGrantor && currentUid ? currentUid : seed.grantorId;

        await setDoc(agreementRef, {
          id: seed.id,
          title: seed.title,
          grantorId,
          grantorName: seed.grantorName,
          grantorEmail,
          granteeId: seed.granteeId,
          granteeName: seed.granteeName,
          granteeEmail: seed.granteeEmail,
          description: seed.description,
          totalCommitment: seed.totalCommitment,
          status: seed.status,
          createdAt: seed.createdAt
        });

        for (const ms of seed.milestones) {
          const msRef = doc(db, 'funding_agreements', seed.id, 'milestones', ms.id);
          await setDoc(msRef, ms);
        }
      }
    }

    // Seed initial evaluations
    for (const [evalId, report] of Object.entries(sampleEvaluationReports)) {
      const evalRef = doc(db, 'evaluations', evalId);
      const snap = await getDoc(evalRef);
      if (!snap.exists()) {
        await setDoc(evalRef, report);
      }
    }

    // Seed initial audit logs
    for (const log of initialAuditLogs) {
      const logRef = doc(db, 'audit_logs', log.id);
      const snap = await getDoc(logRef);
      if (!snap.exists()) {
        await setDoc(logRef, log);
      }
    }
  } catch (error) {
    console.warn('Database initialization deferred or offline:', error);
  }
}

export async function fetchAuthorizedAgreements(
  idToken: string
): Promise<Array<FundingAgreement & { userRole?: 'Grantor' | 'Grantee' }>> {
  const res = await fetch('/api/v1/agreements', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch agreements (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.agreements || [];
}

export function subscribeFundingAgreement(
  agreementId: string,
  onAgreementUpdate: (agreement: FundingAgreement) => void,
  onError?: (err: any) => void
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
    err => {
      if (onError) onError(err);
      else console.warn(`Firestore agreement subscription warning for ${agreementId}:`, err);
    }
  );

  const unsubMilestones = onSnapshot(
    milestonesCol,
    snapshot => {
      currentMilestones = snapshot.docs.map(d => d.data() as Milestone);
      updateCombined();
    },
    err => {
      if (onError) onError(err);
      else console.warn(`Firestore milestones subscription warning for ${agreementId}:`, err);
    }
  );

  return () => {
    unsubAgreement();
    unsubMilestones();
  };
}

export function subscribeEvaluations(
  onUpdate: (evals: Record<string, EvaluationReport>) => void,
  agreementId?: string,
  onError?: (err: any) => void
) {
  const colRef = collection(db, 'evaluations');
  const q = agreementId
    ? query(colRef, where('agreement_id', '==', agreementId))
    : colRef;
  return onSnapshot(
    q,
    snapshot => {
      const reports: Record<string, EvaluationReport> = {};
      snapshot.docs.forEach(docSnap => {
        reports[docSnap.id] = docSnap.data() as EvaluationReport;
      });
      onUpdate(reports);
    },
    err => {
      if (onError) {
        onError(err);
      } else {
        handleFirestoreError(err, OperationType.LIST, 'evaluations');
      }
    }
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

export function subscribeAuditLogs(
  onUpdate: (logs: AuditLogEntry[]) => void,
  agreementId?: string,
  onError?: (err: any) => void
) {
  const colRef = collection(db, 'audit_logs');
  const q = agreementId
    ? query(colRef, where('agreementId', '==', agreementId))
    : query(colRef, orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    snapshot => {
      const items = snapshot.docs.map(d => d.data() as AuditLogEntry);
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(items);
    },
    err => {
      if (onError) {
        onError(err);
      } else {
        handleFirestoreError(err, OperationType.LIST, 'audit_logs');
      }
    }
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
