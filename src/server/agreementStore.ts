import { FundingAgreement } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';
import { initialFundingAgreements } from '../data/mockData';
import { checkAgreementAuthorization, AuthenticatedUser } from './auth';

// Authoritative in-memory agreement registry for server execution and test isolation
const authoritativeRegistry = new Map<string, FundingAgreement>();

// Seed fixture agreements in test and development environments.
// In production (NODE_ENV === 'production'), the registry starts empty and only caches agreements authoritatively verified via Firestore.
if (process.env.NODE_ENV !== 'production') {
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

      // If Cloud Firestore explicitly denies access, fail closed immediately
      if (res.status === 403 || res.status === 401) {
        return null;
      }

      // If document is not found in Firestore (e.g., unseeded dev environment)
      if (res.status === 404) {
        if (process.env.NODE_ENV !== 'production' && authoritativeRegistry.has(agreementId)) {
          return authoritativeRegistry.get(agreementId)!;
        }
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
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // 2. Authoritative Server Registry resolution (for hermetic test isolation and development mode)
  if (authoritativeRegistry.has(agreementId)) {
    return authoritativeRegistry.get(agreementId)!;
  }

  // 3. Fail closed: Return null. Never invent or return unauthorized fixtures.
  return null;
}

/**
 * Resolves all agreements for which the authenticated user is an authorized participant (Grantor or Grantee).
 * - In test environment, queries the isolated authoritativeRegistry.
 * - In production, queries the Cloud Firestore REST runQuery API using the caller's verified Bearer token.
 * - Returns null if authoritative data cannot be retrieved (fails closed, never silently substitutes mock agreements in production).
 */
export async function getAuthoritativeAgreementsForUser(
  user: AuthenticatedUser,
  rawIdToken?: string,
  customFetchFn: typeof fetch = fetch
): Promise<Array<{ agreement: FundingAgreement; role: 'Grantor' | 'Grantee' }> | null> {
  if (!user || !user.uid) {
    return null;
  }

  // 1. In hermetic test mode with default fetch, resolve via authoritative test registry
  if ((process.env.NODE_ENV === 'test' || process.env.VITEST) && customFetchFn === fetch) {
    const results: Array<{ agreement: FundingAgreement; role: 'Grantor' | 'Grantee' }> = [];
    for (const agreement of authoritativeRegistry.values()) {
      const auth = checkAgreementAuthorization(user, agreement);
      if (auth.authorized && auth.role) {
        results.push({ agreement, role: auth.role });
      }
    }
    return results;
  }

  // 2. Production: Live Cloud Firestore REST resolution with user's verified Bearer token
  if (rawIdToken && rawIdToken.split('.').length === 3) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;

      const userEmail = user.email?.trim().toLowerCase();
      const filters: any[] = [
        {
          fieldFilter: {
            field: { fieldPath: 'grantorId' },
            op: 'EQUAL',
            value: { stringValue: user.uid }
          }
        },
        {
          fieldFilter: {
            field: { fieldPath: 'granteeId' },
            op: 'EQUAL',
            value: { stringValue: user.uid }
          }
        }
      ];

      if (user.email_verified && userEmail) {
        filters.push({
          fieldFilter: {
            field: { fieldPath: 'grantorEmail' },
            op: 'EQUAL',
            value: { stringValue: userEmail }
          }
        });
        filters.push({
          fieldFilter: {
            field: { fieldPath: 'granteeEmail' },
            op: 'EQUAL',
            value: { stringValue: userEmail }
          }
        });
      }

      const body = {
        structuredQuery: {
          from: [{ collectionId: 'funding_agreements' }],
          where: {
            compositeFilter: {
              op: 'OR',
              filters
            }
          }
        }
      };

      const res = await customFetchFn(runQueryUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${rawIdToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        return null;
      }

      const rows = await res.json();
      if (!Array.isArray(rows)) {
        return [];
      }

      const results: Array<{ agreement: FundingAgreement; role: 'Grantor' | 'Grantee' }> = [];
      const seenIds = new Set<string>();

      for (const row of rows) {
        if (!row.document || !row.document.fields) continue;
        const f = row.document.fields;
        const agreementId = f.id?.stringValue || row.document.name.split('/').pop();
        if (seenIds.has(agreementId)) continue;
        seenIds.add(agreementId);

        const agreement: FundingAgreement = {
          id: agreementId,
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

        const auth = checkAgreementAuthorization(user, agreement);
        if (auth.authorized && auth.role) {
          results.push({ agreement, role: auth.role });
        }
      }

      // Return results directly (including empty array) when authoritative query succeeds
      return results;
    } catch {
      // Failed to execute live query
    }
  }

  // In production, NEVER fall back to in-memory fixtures. Return null if authoritative data unavailable.
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Fallback in test runner and development mode when Firestore is unseeded
  const results: Array<{ agreement: FundingAgreement; role: 'Grantor' | 'Grantee' }> = [];
  for (const agreement of authoritativeRegistry.values()) {
    const auth = checkAgreementAuthorization(user, agreement);
    if (auth.authorized && auth.role) {
      results.push({ agreement, role: auth.role });
    }
  }
  return results;
}

