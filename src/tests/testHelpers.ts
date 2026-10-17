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
  email_verified?: boolean;
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
    email_verified: overrides?.email_verified ?? true,
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

/**
 * Creates a mock GoogleGenAI client for test isolation (zero real network calls).
 */
export function createMockGeminiClient(options?: {
  responseText?: string;
  throwError?: Error;
  delayMs?: number;
}) {
  return {
    models: {
      generateContent: async () => {
        if (options?.delayMs) {
          await new Promise((r) => setTimeout(r, options.delayMs));
        }
        if (options?.throwError) {
          throw options.throwError;
        }
        return {
          text:
            options?.responseText ??
            JSON.stringify({
              overall_summary:
                'Evaluated milestone progress against pre-agreed criteria using verified repository evidence.',
              criteria_results: [
                {
                  criterion: 'A user can submit the registration form and receive account confirmation.',
                  status: 'supported',
                  explanation:
                    'PR #12 implements member registration modal and confirmation dialog.',
                  evidence: [
                    {
                      type: 'pull_request',
                      title: 'PR #12: Add member registration form and confirmation dialog',
                      url: 'https://github.com/example/community-tools/pull/12'
                    }
                  ]
                },
                {
                  criterion: 'Invalid input produces clear, understandable validation errors preventing submission.',
                  status: 'insufficient_evidence',
                  explanation:
                    'The available repository evidence does not demonstrate invalid input error handling.',
                  evidence: []
                },
                {
                  criterion: 'Automated test suite covers both successful and unsuccessful registration paths.',
                  status: 'uncertain',
                  explanation:
                    'PR #14 and commit 4a7e2b1 add test scaffolds, but do not verify error rejection paths.',
                  evidence: [
                    {
                      type: 'pull_request',
                      title: 'PR #14: Initial test harness and mock runner setup',
                      url: 'https://github.com/example/community-tools/pull/14'
                    }
                  ]
                }
              ],
              suggested_next_steps: [
                'Review PR #12 diff for validation edge cases.',
                'Have authorized human grantor make final funding decision.'
              ],
              limitations: [
                'Repository activity alone does not prove production runtime behavior.'
              ]
            })
        };
      }
    }
  };
}
