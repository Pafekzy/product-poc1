import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAuthoritativeAgreementsForUser,
  getLastFirestoreQueryDiagnostics,
  clearFirestoreQueryDiagnostics
} from '../server/agreementStore';
import { handleApiRequest } from '../server/api';
import { testKeySet, createSignedFirebaseToken } from './testHelpers';
import firebaseConfig from '../../firebase-applet-config.json';
import fs from 'fs';
import path from 'path';

describe('VeriCommit — Firestore Agreement Retrieval Diagnostics (FSD-01 through FSD-08)', () => {
  beforeEach(() => {
    clearFirestoreQueryDiagnostics();
    vi.restoreAllMocks();
  });

  describe('FSD-01 & FSD-02: Configuration & Query Structure Inspection', () => {
    it('verifies the configured Firebase project ID and Firestore database ID are present and non-empty', () => {
      expect(firebaseConfig.projectId).toBeDefined();
      expect(typeof firebaseConfig.projectId).toBe('string');
      expect(firebaseConfig.projectId.length).toBeGreaterThan(0);
      expect(firebaseConfig.projectId).toBe('gen-lang-client-0794300436');

      expect(firebaseConfig.firestoreDatabaseId).toBeDefined();
      expect(typeof firebaseConfig.firestoreDatabaseId).toBe('string');
      expect(firebaseConfig.firestoreDatabaseId.length).toBeGreaterThan(0);
      expect(firebaseConfig.firestoreDatabaseId).toBe('ai-studio-vericommitproduc-754190ee-bf62-467b-86b3-21565cd7bd7b');
    });

    it('verifies structured query targets funding_agreements collection and constructs valid REST query syntax', () => {
      const storeSource = fs.readFileSync(path.resolve(__dirname, '../server/agreementStore.ts'), 'utf-8');
      expect(storeSource).toContain("collectionId: 'funding_agreements'");
      expect(storeSource).toContain("compositeFilter:");
      expect(storeSource).toContain("op: 'OR'");
      expect(storeSource).toContain("documents:runQuery");
    });
  });

  describe('FSD-03 & FSD-04: Safe Diagnostic Capture and Logging', () => {
    it('captures safe diagnostics on HTTP 403 PERMISSION_DENIED without leaking tokens', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            code: 403,
            message: 'Missing or insufficient permissions for request with token Bearer secret-raw-token-12345.',
            status: 'PERMISSION_DENIED'
          }
        })
      });

      const user = { uid: 'user-diagnostics-test', email: 'test@example.com', email_verified: true };
      const rawToken = 'header.payload.signature';

      const result = await getAuthoritativeAgreementsForUser(user, rawToken, mockFetch);
      expect(result).toBeNull(); // Fail closed

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag).not.toBeNull();
      expect(diag?.status).toBe(403);
      expect(diag?.statusText).toBe('Forbidden');
      expect(diag?.errorStatus).toBe('PERMISSION_DENIED');
      expect(diag?.errorCode).toBe(403);
      expect(diag?.projectId).toBe('gen-lang-client-0794300436');
      expect(diag?.databaseId).toBe('ai-studio-vericommitproduc-754190ee-bf62-467b-86b3-21565cd7bd7b');

      // Crucial security requirement: tokens must be redacted
      expect(diag?.errorMessage).not.toContain('secret-raw-token-12345');
      expect(diag?.errorMessage).toContain('[REDACTED_TOKEN]');

      // Console error must be called safely
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMsg = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMsg).toContain('[FirestoreDiagnostics]');
      expect(loggedMsg).toContain('HTTP 403');
      expect(loggedMsg).toContain('PERMISSION_DENIED');
      expect(loggedMsg).not.toContain('secret-raw-token-12345');
    });

    it('captures safe diagnostics on HTTP 400 INVALID_ARGUMENT (e.g. index requirement or syntax)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            code: 400,
            message: 'The query requires an index. You can create it here: https://console.firebase.google.com/...',
            status: 'FAILED_PRECONDITION'
          }
        })
      });

      const user = { uid: 'user-diagnostics-test', email: 'test@example.com', email_verified: true };
      const result = await getAuthoritativeAgreementsForUser(user, 'a.b.c', mockFetch);
      expect(result).toBeNull();

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag?.status).toBe(400);
      expect(diag?.errorStatus).toBe('FAILED_PRECONDITION');
      expect(diag?.errorCode).toBe(400);
    });

    it('captures safe diagnostics on HTTP 404 NOT_FOUND (e.g. named database not provisioned)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: {
            code: 404,
            message: 'Database not found.',
            status: 'NOT_FOUND'
          }
        })
      });

      const user = { uid: 'user-diagnostics-test', email: 'test@example.com', email_verified: true };
      const result = await getAuthoritativeAgreementsForUser(user, 'a.b.c', mockFetch);
      expect(result).toBeNull();

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag?.status).toBe(404);
      expect(diag?.errorStatus).toBe('NOT_FOUND');
    });

    it('captures runtime exceptions (e.g. DNS failure or network timeout) safely', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockFetch: any = vi.fn().mockRejectedValue(
        new Error('Fetch failed connecting to firestore.googleapis.com with eyJhbGciOiJSUzI1NiJ9.secret')
      );

      const user = { uid: 'user-diagnostics-test', email: 'test@example.com', email_verified: true };
      const result = await getAuthoritativeAgreementsForUser(user, 'a.b.c', mockFetch);
      expect(result).toBeNull();

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag?.isException).toBe(true);
      expect(diag?.isException).toBe(true);
      expect(diag?.exceptionMessage).not.toContain('eyJhbGciOiJSUzI1NiJ9.secret');
      expect(diag?.exceptionMessage).toContain('[REDACTED_JWT]');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMsg = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMsg).toContain('[FirestoreDiagnostics] runQuery exception:');
      expect(loggedMsg).not.toContain('eyJhbGciOiJSUzI1NiJ9.secret');
    });

    it('FSD3: parses Firestore runQuery array error responses correctly ([{ error: ... }])', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => JSON.stringify([
          {
            error: {
              code: 403,
              message: 'Missing or insufficient permissions.',
              status: 'PERMISSION_DENIED'
            }
          }
        ])
      });

      const user = { uid: 'user-diagnostics-array', email: 'test@example.com', email_verified: true };
      const result = await getAuthoritativeAgreementsForUser(user, 'header.payload.signature', mockFetch);
      expect(result).toBeNull();

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag?.status).toBe(403);
      expect(diag?.statusText).toBe('Forbidden');
      expect(diag?.errorStatus).toBe('PERMISSION_DENIED');
      expect(diag?.errorCode).toBe(403);
      expect(diag?.errorMessage).toBe('Missing or insufficient permissions.');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMsg = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMsg).toContain('[FirestoreDiagnostics] runQuery failed: HTTP 403 Forbidden | status=PERMISSION_DENIED | code=403 | message=Missing or insufficient permissions.');
    });

    it('FSD3: handles non-JSON HTML error responses safely without losing HTTP status or crashing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const htmlBody = '<html><head><title>403 Forbidden</title></head><body><h1>Forbidden</h1><p>Access Denied by Edge Proxy</p></body></html>';
      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => htmlBody
      });

      const user = { uid: 'user-diagnostics-html', email: 'test@example.com', email_verified: true };
      const result = await getAuthoritativeAgreementsForUser(user, 'header.payload.signature', mockFetch);
      expect(result).toBeNull();

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag?.status).toBe(403);
      expect(diag?.statusText).toBe('Forbidden');
      expect(diag?.errorStatus).toBeUndefined();
      expect(diag?.errorCode).toBeUndefined();
      expect(diag?.errorMessage).toContain('Forbidden');
      expect(diag?.rawSnippet).toContain('Access Denied by Edge Proxy');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMsg = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMsg).toContain('[FirestoreDiagnostics] runQuery failed: HTTP 403 Forbidden | status=UNKNOWN | code=UNKNOWN');
      expect(loggedMsg).toContain('Forbidden');
      expect(loggedMsg).not.toContain('message=None'); // Ensures actual snippet is exposed, not 'None'
    });

    it('FSD3: handles malformed JSON error responses safely', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const brokenJson = '{"error": {"code": 403, "message": "Incomplete payload';
      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => brokenJson
      });

      const user = { uid: 'user-diagnostics-malformed', email: 'test@example.com', email_verified: true };
      const result = await getAuthoritativeAgreementsForUser(user, 'header.payload.signature', mockFetch);
      expect(result).toBeNull();

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag?.status).toBe(403);
      expect(diag?.rawSnippet).toBe('{"error": {"code": 403, "message": "Incomplete payload');
      expect(diag?.errorMessage).toBe('{"error": {"code": 403, "message": "Incomplete payload');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMsg = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMsg).toContain('[FirestoreDiagnostics] runQuery failed: HTTP 403 Forbidden | status=UNKNOWN | code=UNKNOWN');
    });

    it('FSD3: redacts API keys and tokens in both structured messages and raw snippets', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sensitiveText = 'Error for key AIzaSyBtPNNqFInIg2NucNQVnaUPO-BkMaLzp5o with token Bearer secret-auth-token-12345';
      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => JSON.stringify({
          error: {
            code: 403,
            status: 'PERMISSION_DENIED',
            message: sensitiveText
          }
        })
      });

      const user = { uid: 'user-diagnostics-redact', email: 'test@example.com', email_verified: true };
      await getAuthoritativeAgreementsForUser(user, 'header.payload.signature', mockFetch);

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag?.errorMessage).not.toContain('AIzaSyBtPNNqFInIg2NucNQVnaUPO-BkMaLzp5o');
      expect(diag?.errorMessage).not.toContain('secret-auth-token-12345');
      expect(diag?.errorMessage).toContain('[REDACTED_KEY]');
      expect(diag?.errorMessage).toContain('[REDACTED_TOKEN]');

      expect(diag?.rawSnippet).not.toContain('AIzaSyBtPNNqFInIg2NucNQVnaUPO-BkMaLzp5o');
      expect(diag?.rawSnippet).not.toContain('secret-auth-token-12345');
      expect(diag?.rawSnippet).toContain('[REDACTED_KEY]');
      expect(diag?.rawSnippet).toContain('[REDACTED_TOKEN]');

      const loggedMsg = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMsg).not.toContain('AIzaSyBtPNNqFInIg2NucNQVnaUPO-BkMaLzp5o');
      expect(loggedMsg).not.toContain('secret-auth-token-12345');
    });

    it('FSD3: handles empty response bodies safely preserving HTTP status and statusText', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => ''
      });

      const user = { uid: 'user-diagnostics-empty', email: 'test@example.com', email_verified: true };
      const result = await getAuthoritativeAgreementsForUser(user, 'header.payload.signature', mockFetch);
      expect(result).toBeNull();

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag?.status).toBe(403);
      expect(diag?.statusText).toBe('Forbidden');
      expect(diag?.errorMessage).toBeUndefined();
      expect(diag?.rawSnippet).toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMsg = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMsg).toContain('[FirestoreDiagnostics] runQuery failed: HTTP 403 Forbidden | status=UNKNOWN | code=UNKNOWN | message=None');
    });
  });

  describe('FSD-05: Client API Contract Preservation', () => {
    it('returns generic PERSISTENCE_UNAVAILABLE (502) and never leaks raw Google Cloud error details to clients', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const token = await createSignedFirebaseToken({
        uid: 'user-test-502',
        email: 'user502@example.com',
        email_verified: true
      });

      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            code: 403,
            message: 'Internal Google Cloud IAM detail: projects/gen-lang-client-0794300436/databases/...',
            status: 'PERMISSION_DENIED'
          }
        })
      });

      let statusCode = 0;
      let responseBody = '';

      const mockReq: any = {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` }
      };
      const mockRes: any = {
        setHeader: () => {},
        set statusCode(val: number) { statusCode = val; },
        end: (data: string) => { responseBody = data; }
      };

      const url = new URL('http://localhost:3000/api/v1/agreements');
      await handleApiRequest(mockReq, mockRes, url, '', testKeySet, mockFetch);

      expect(statusCode).toBe(502);
      const parsed = JSON.parse(responseBody);
      expect(parsed.error.code).toBe('PERSISTENCE_UNAVAILABLE');
      expect(parsed.error.message).toBe('Authoritative funding agreement data could not be retrieved from Firestore.');
      // Raw Google Cloud details MUST NOT be exposed in the response body
      expect(responseBody).not.toContain('PERMISSION_DENIED');
      expect(responseBody).not.toContain('Internal Google Cloud IAM detail');
    });
  });

  describe('FSD-06 & FSD-07: Fail-Closed & Empty State Behavior Preservation', () => {
    it('preserves fail-closed behavior: never authorizes a user or provides mock data on failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: { code: 500, message: 'Backend crash' } })
      });

      const user = { uid: 'g-101', email: 'imaginright.dev@gmail.com', email_verified: true };
      const result = await getAuthoritativeAgreementsForUser(user, 'a.b.c', mockFetch);
      expect(result).toBeNull();
    });

    it('preserves empty-state behavior: successful query with 0 matching documents returns empty array and HTTP 200', async () => {
      const token = await createSignedFirebaseToken({
        uid: 'legitimate-user-no-agreements',
        email: 'empty@example.com',
        email_verified: true
      });

      // Firestore runQuery returns [{ readTime: "..." }] when zero documents match
      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => [{ readTime: '2026-10-20T20:00:00.000Z' }]
      });

      let statusCode = 0;
      let responseBody = '';

      const mockReq: any = {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` }
      };
      const mockRes: any = {
        setHeader: () => {},
        set statusCode(val: number) { statusCode = val; },
        end: (data: string) => { responseBody = data; }
      };

      const url = new URL('http://localhost:3000/api/v1/agreements');
      await handleApiRequest(mockReq, mockRes, url, '', testKeySet, mockFetch);

      expect(statusCode).toBe(200);
      const parsed = JSON.parse(responseBody);
      expect(parsed.total).toBe(0);
      expect(parsed.agreements).toEqual([]);
      expect(parsed.userId).toBe('legitimate-user-no-agreements');
    });

    it('returns authorized agreements with correct role when documents match', async () => {
      const token = await createSignedFirebaseToken({
        uid: 'user-grantor-live',
        email: 'grantor@example.com',
        email_verified: true
      });

      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => [
          {
            document: {
              name: 'projects/gen-lang-client-0794300436/databases/ai-studio-vericommitproduc-754190ee-bf62-467b-86b3-21565cd7bd7b/documents/funding_agreements/fa-live-100',
              fields: {
                id: { stringValue: 'fa-live-100' },
                title: { stringValue: 'Live Verified Agreement' },
                grantorId: { stringValue: 'user-grantor-live' },
                grantorName: { stringValue: 'Live Grantor' },
                granteeId: { stringValue: 'grantee-live-200' },
                granteeName: { stringValue: 'Live Grantee' },
                status: { stringValue: 'active' },
                createdAt: { stringValue: '2026-01-01T00:00:00Z' }
              }
            }
          }
        ]
      });

      let statusCode = 0;
      let responseBody = '';

      const mockReq: any = {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` }
      };
      const mockRes: any = {
        setHeader: () => {},
        set statusCode(val: number) { statusCode = val; },
        end: (data: string) => { responseBody = data; }
      };

      const url = new URL('http://localhost:3000/api/v1/agreements');
      await handleApiRequest(mockReq, mockRes, url, '', testKeySet, mockFetch);

      expect(statusCode).toBe(200);
      const parsed = JSON.parse(responseBody);
      expect(parsed.total).toBe(1);
      expect(parsed.agreements[0].id).toBe('fa-live-100');
      expect(parsed.agreements[0].userRole).toBe('Grantor');
    });
  });

  describe('FSD-08: REST runQuery Outgoing Request Construction Regression', () => {
    it('constructs exact runQuery URL, headers, and payload with UID and verified-email branches for a verified user', async () => {
      let capturedUrl = '';
      let capturedOptions: any = null;

      const mockFetch: any = vi.fn().mockImplementation(async (url: string, options: any) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => [{ readTime: '2026-10-20T20:00:00.000Z' }]
        };
      });

      const user = {
        uid: 'usr-verified-123',
        email: 'Grantor.Test@Example.COM',
        email_verified: true
      };
      const syntheticToken = 'header.synthetic-payload.signature';

      await getAuthoritativeAgreementsForUser(user, syntheticToken, mockFetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 1. Verify URL targets configured project and named database
      const expectedUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents:runQuery`;
      expect(capturedUrl).toBe(expectedUrl);

      // 2. Verify HTTP method and headers
      expect(capturedOptions.method).toBe('POST');
      expect(capturedOptions.headers).toBeDefined();
      expect(capturedOptions.headers['Authorization']).toBe(`Bearer ${syntheticToken}`);
      expect(capturedOptions.headers['Content-Type']).toBe('application/json');
      expect(capturedOptions.headers['Accept']).toBe('application/json');

      // 3. Verify outgoing body structure and target collection
      const body = JSON.parse(capturedOptions.body);
      expect(body.structuredQuery).toBeDefined();
      expect(body.structuredQuery.from).toEqual([{ collectionId: 'funding_agreements' }]);

      // 4. Verify composite OR filter
      const compositeFilter = body.structuredQuery.where?.compositeFilter;
      expect(compositeFilter).toBeDefined();
      expect(compositeFilter.op).toBe('OR');
      expect(Array.isArray(compositeFilter.filters)).toBe(true);

      const filters = compositeFilter.filters;
      // Verified user must have 4 branches: 2 UID + 2 email
      expect(filters).toHaveLength(4);

      // Branch 1: grantorId == user.uid
      expect(filters[0]).toEqual({
        fieldFilter: {
          field: { fieldPath: 'grantorId' },
          op: 'EQUAL',
          value: { stringValue: 'usr-verified-123' }
        }
      });

      // Branch 2: granteeId == user.uid
      expect(filters[1]).toEqual({
        fieldFilter: {
          field: { fieldPath: 'granteeId' },
          op: 'EQUAL',
          value: { stringValue: 'usr-verified-123' }
        }
      });

      // Branch 3: grantorEmail == lowercased email
      expect(filters[2]).toEqual({
        fieldFilter: {
          field: { fieldPath: 'grantorEmail' },
          op: 'EQUAL',
          value: { stringValue: 'grantor.test@example.com' }
        }
      });

      // Branch 4: granteeEmail == lowercased email
      expect(filters[3]).toEqual({
        fieldFilter: {
          field: { fieldPath: 'granteeEmail' },
          op: 'EQUAL',
          value: { stringValue: 'grantor.test@example.com' }
        }
      });
    });

    it('strictly excludes email filter branches when user is unverified, retaining only UID branches', async () => {
      let capturedOptions: any = null;

      const mockFetch: any = vi.fn().mockImplementation(async (_url: string, options: any) => {
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => [{ readTime: '2026-10-20T20:00:00.000Z' }]
        };
      });

      const user = {
        uid: 'usr-unverified-456',
        email: 'unverified@example.com',
        email_verified: false
      };

      await getAuthoritativeAgreementsForUser(user, 'synthetic.token.jwt', mockFetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const body = JSON.parse(capturedOptions.body);
      const filters = body.structuredQuery?.where?.compositeFilter?.filters;

      // Unverified user MUST only have the 2 UID branches
      expect(filters).toHaveLength(2);

      expect(filters[0]).toEqual({
        fieldFilter: {
          field: { fieldPath: 'grantorId' },
          op: 'EQUAL',
          value: { stringValue: 'usr-unverified-456' }
        }
      });

      expect(filters[1]).toEqual({
        fieldFilter: {
          field: { fieldPath: 'granteeId' },
          op: 'EQUAL',
          value: { stringValue: 'usr-unverified-456' }
        }
      });

      // Assert no email fields are present in any filter
      const fieldsQueried = filters.map((f: any) => f.fieldFilter?.field?.fieldPath);
      expect(fieldsQueried).not.toContain('grantorEmail');
      expect(fieldsQueried).not.toContain('granteeEmail');
    });

    it('excludes email filter branches when user email is absent, even if email_verified is true', async () => {
      let capturedOptions: any = null;

      const mockFetch: any = vi.fn().mockImplementation(async (_url: string, options: any) => {
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => [{ readTime: '2026-10-20T20:00:00.000Z' }]
        };
      });

      const user = {
        uid: 'usr-no-email-789',
        email_verified: true
      };

      await getAuthoritativeAgreementsForUser(user, 'synthetic.token.jwt', mockFetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const body = JSON.parse(capturedOptions.body);
      const filters = body.structuredQuery?.where?.compositeFilter?.filters;

      expect(filters).toHaveLength(2);
      expect(filters[0].fieldFilter.field.fieldPath).toBe('grantorId');
      expect(filters[1].fieldFilter.field.fieldPath).toBe('granteeId');
    });

    it('ensures synthetic tokens in error responses are redacted from diagnostics and logs during runQuery', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const syntheticRequestToken = 'synthetic-jwt-header.synthetic-request-payload-999.synthetic-signature-xyz';

      const mockFetch: any = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => JSON.stringify({
          error: {
            code: 403,
            message: `Missing or insufficient permissions for request with Bearer ${syntheticRequestToken} on target project`,
            status: 'PERMISSION_DENIED'
          }
        })
      });

      const user = { uid: 'usr-secret-check', email: 'sec@example.com', email_verified: true };
      await getAuthoritativeAgreementsForUser(user, syntheticRequestToken, mockFetch);

      const diag = getLastFirestoreQueryDiagnostics();
      expect(diag).not.toBeNull();
      expect(diag?.status).toBe(403);
      expect(diag?.errorMessage).not.toContain(syntheticRequestToken);
      expect(diag?.errorMessage).toContain('[REDACTED_TOKEN]');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMsg = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMsg).not.toContain(syntheticRequestToken);
      expect(loggedMsg).toContain('[REDACTED_TOKEN]');
    });
  });
});

