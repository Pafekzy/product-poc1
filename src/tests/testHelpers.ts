import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Creates a mock Firebase JWT token for automated testing
 */
export function createMockFirebaseToken(overrides?: {
  uid?: string;
  email?: string;
  exp?: number;
  aud?: string;
  iss?: string;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  
  const now = Math.floor(Date.now() / 1000);
  const projectId = firebaseConfig.projectId;

  const payload = {
    iss: overrides?.iss ?? `https://securetoken.google.com/${projectId}`,
    aud: overrides?.aud ?? projectId,
    sub: overrides?.uid ?? 'test-grantor-uid-123',
    email: overrides?.email ?? 'elena.grantor@example.org',
    email_verified: true,
    auth_time: now - 60,
    iat: now - 60,
    exp: overrides?.exp ?? (now + 3600),
    name: 'Elena Vance'
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock-valid-signature';

  return `${header}.${payloadEncoded}.${signature}`;
}
