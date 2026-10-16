import { generateKeyPair, SignJWT, exportJWK, JWTVerifyGetKey } from 'jose';
import firebaseConfig from '../../firebase-applet-config.json';

// Generate a deterministic RSA keypair for testing
let testPrivateKey: any = null;
let testPublicKey: any = null;
let testJwk: any = null;

// Another keypair for simulating forged signatures
let foreignPrivateKey: any = null;

export async function initTestCrypto() {
  if (!testPrivateKey) {
    const keys = await generateKeyPair('RS256', { extractable: true });
    testPrivateKey = keys.privateKey;
    testPublicKey = keys.publicKey;
    testJwk = await exportJWK(testPublicKey);
    testJwk.kid = 'test-trusted-key-1';
    testJwk.alg = 'RS256';
    testJwk.use = 'sig';

    const foreignKeys = await generateKeyPair('RS256', { extractable: true });
    foreignPrivateKey = foreignKeys.privateKey;
  }
}

/**
 * Creates a mock JWKS resolver using the test public key
 */
export const testKeySet: JWTVerifyGetKey = async (protectedHeader) => {
  if (protectedHeader.kid === 'test-trusted-key-1' || !protectedHeader.kid) {
    return testPublicKey;
  }
  throw new Error('No matching key found in test JWKS');
};

/**
 * Creates a real cryptographically signed RS256 Firebase ID token for testing
 */
export async function createSignedFirebaseToken(overrides?: {
  uid?: string;
  email?: string;
  expOffsetSeconds?: number;
  aud?: string;
  iss?: string;
  signWithForeignKey?: boolean;
}): Promise<string> {
  await initTestCrypto();

  const now = Math.floor(Date.now() / 1000);
  const projectId = firebaseConfig.projectId;
  const expOffset = overrides?.expOffsetSeconds ?? 3600;

  const signer = new SignJWT({
    email: overrides?.email ?? 'elena.grantor@example.org',
    email_verified: true,
    name: 'Elena Vance'
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-trusted-key-1' })
    .setSubject(overrides?.uid ?? 'test-grantor-uid-123')
    .setIssuer(overrides?.iss ?? `https://securetoken.google.com/${projectId}`)
    .setAudience(overrides?.aud ?? projectId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + expOffset);

  const keyToUse = overrides?.signWithForeignKey ? foreignPrivateKey : testPrivateKey;
  return await signer.sign(keyToUse);
}
