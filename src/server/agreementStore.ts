import { FundingAgreement } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';
import { initialFundingAgreements } from '../data/mockData';

// Authoritative in-memory agreement registry for server execution and test isolation
const authoritativeRegistry = new Map<string, FundingAgreement>();

// Only seed fixture agreements when executing in hermetic test environments.
// In production, the registry starts empty and only caches agreements authoritatively verified via Firestore.
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  for (const ag of initialFundingAgreements) {
    authoritativeRegistry.set(ag.id, ag);
  }
}

/**
 * Registers an authoritative agreement record in the server's authoritative registry.
 */
export function registerAuthoritativeAgreement(agreement: FundingAgreement): void {
  authoritativeRegistry.set(agreement.id, agreement);
}

/**
 * Clears the registry (utilized for deterministic test isolation).
 */
export function clearAuthoritativeRegistry(): void {
  authoritativeRegistry.clear();
}

/**
 * Resolves a FundingAgreement authoritatively:
 * 1. If an idToken is provided, queries the Cloud Firestore REST API using the caller's verified Bearer token.
 * 2. If Firestore REST is unavailable or running in offline tests, queries the authoritative registry.
 * 3. Fails closed (returns null) if the agreement is not found in either authoritative source.
 */
export async function getAuthoritativeAgreement(
  agreementId: string,
  rawIdToken?: string,
  customFetchFn: typeof fetch = fetch
): Promise<FundingAgreement | null> {
  if (!agreementId || typeof agreementId !== 'string') {
    return null;
  }

  // 1. Live Cloud Firestore REST resolution with the user's verified Bearer token
  if (rawIdToken && rawIdToken.split('.').length === 3) {
    // In hermetic test mode with default fetch, resolve via test registry to avoid live network calls
    if ((process.env.NODE_ENV === 'test' || process.env.VITEST) && customFetchFn === fetch) {
      if (authoritativeRegistry.has(agreementId)) {
        return authoritativeRegistry.get(agreementId)!;
      }
      return null;
    }

    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/funding_agreements/${encodeURIComponent(agreementId)}`;

      const res = await customFetchFn(docUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${rawIdToken}`,
          Accept: 'application/json'
        }
      });

      // If Cloud Firestore explicitly denies access or states document not found, fail closed
      if (res.status === 404 || res.status === 403 || res.status === 401) {
        return null;
      }

      if (res.ok) {
        const docJson = await res.json();
        if (docJson && typeof docJson === 'object' && !Array.isArray(docJson) && docJson.fields) {
          const f = docJson.fields || {};

        const agreement: FundingAgreement = {
          id: f.id?.stringValue || agreementId,
          title: f.title?.stringValue || 'Untitled Agreement',
          grantorId: f.grantorId?.stringValue || '',
          grantorName: f.grantorName?.stringValue || '',
          grantorEmail: f.grantorEmail?.stringValue,
          granteeId: f.granteeId?.stringValue || '',
          granteeName: f.granteeName?.stringValue || '',
          granteeEmail: f.granteeEmail?.stringValue,
          description: f.description?.stringValue || '',
          totalCommitment: f.totalCommitment?.stringValue,
          status: (f.status?.stringValue as any) || 'active',
          createdAt: f.createdAt?.stringValue || new Date().toISOString(),
          milestones: []
        };

        // Fetch milestones subcollection from Firestore
        const msRes = await customFetchFn(`${docUrl}/milestones`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${rawIdToken}`,
            Accept: 'application/json'
          }
        });

        if (msRes.ok) {
          const msJson = await msRes.json();
          if (Array.isArray(msJson.documents)) {
            agreement.milestones = msJson.documents.map((d: any) => {
              const mf = d.fields || {};
              return {
                id: mf.id?.stringValue || d.name.split('/').pop(),
                fundingAgreementId: mf.fundingAgreementId?.stringValue || agreementId,
                title: mf.title?.stringValue || '',
                description: mf.description?.stringValue || '',
                repositoryUrl: mf.repositoryUrl?.stringValue,
                evidenceSource: (mf.evidenceSource?.stringValue as any) || 'sample',
                targetDate: mf.targetDate?.stringValue,
                evaluationId: mf.evaluationId?.stringValue,
                createdAt: mf.createdAt?.stringValue || new Date().toISOString(),
                updatedAt: mf.updatedAt?.stringValue || new Date().toISOString(),
                acceptanceCriteria: []
              };
            });
          }
        }

        return agreement;
      }
    }
  } catch {
      // Network unreachable or offline
    }
  }

  // In production, NEVER fall back to in-memory registry. Fail closed.
  if (!(process.env.NODE_ENV === 'test' || process.env.VITEST)) {
    return null;
  }

  // 2. Authoritative Server Registry resolution (strictly for hermetic unit/integration test isolation)
  if (authoritativeRegistry.has(agreementId)) {
    return authoritativeRegistry.get(agreementId)!;
  }

  // 3. Fail closed: Return null. Never invent or return unauthorized fixtures.
  return null;
}
