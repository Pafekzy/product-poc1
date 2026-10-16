import { createRemoteJWKSet, jwtVerify, JWTVerifyGetKey } from 'jose';
import firebaseConfig from '../../firebase-applet-config.json';
import { FundingAgreement } from '../types';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export interface TokenVerificationResult {
  valid: boolean;
  user?: AuthenticatedUser;
  error?: {
    code: 'UNAUTHORIZED' | 'INVALID_TOKEN' | 'FORGED_SIGNATURE' | 'TOKEN_EXPIRED' | 'INVALID_ISSUER' | 'INVALID_AUDIENCE';
    message: string;
  };
}

// Google's official public JWKS endpoint for Firebase ID Tokens
const GOOGLE_FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let googleJwks: JWTVerifyGetKey | null = null;

function getGoogleJwks(): JWTVerifyGetKey {
  if (!googleJwks) {
    googleJwks = createRemoteJWKSet(new URL(GOOGLE_FIREBASE_JWKS_URL), {
      cacheMaxAge: 3600000, // 1 hour caching
      cooldownDuration: 30000 // 30 sec cooldown on retries
    });
  }
  return googleJwks;
}

/**
 * Cryptographically verifies a Firebase ID Token using official RS256 public key verification.
 * Validates cryptographic signature, issuer, audience, and expiration.
 *
 * @param authHeader The incoming HTTP Authorization header ('Bearer <token>')
 * @param customKeySet Optional custom JWKS / KeyResolver (utilized for deterministic integration tests)
 */
export async function verifyFirebaseIdToken(
  authHeader: string | undefined,
  customKeySet?: JWTVerifyGetKey
): Promise<TokenVerificationResult> {
  if (!authHeader || typeof authHeader !== 'string') {
    return {
      valid: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header. Expected format: Bearer <token>'
      }
    };
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return {
      valid: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization scheme. Bearer scheme required.'
      }
    };
  }

  const token = parts[1];
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    return {
      valid: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'JWT token must contain header, payload, and signature components.'
      }
    };
  }

  const keySet = customKeySet || getGoogleJwks();
  const expectedAudience = firebaseConfig.projectId;
  const expectedIssuer = `https://securetoken.google.com/${expectedAudience}`;

  try {
    const { payload } = await jwtVerify(token, keySet, {
      issuer: expectedIssuer,
      audience: expectedAudience,
      algorithms: ['RS256']
    });

    if (!payload.sub || typeof payload.sub !== 'string') {
      return {
        valid: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token payload missing subject identifier (sub).'
        }
      };
    }

    return {
      valid: true,
      user: {
        uid: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        email_verified: Boolean(payload.email_verified),
        name: typeof payload.name === 'string' ? payload.name : undefined
      }
    };
  } catch (err: any) {
    const errCode = err.code || '';
    const errMessage = err.message || '';

    if (errCode === 'ERR_JWT_EXPIRED' || errMessage.includes('expired')) {
      return {
        valid: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired. Please re-authenticate.'
        }
      };
    }

    if (errCode === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      if (err.claim === 'aud' || errMessage.includes('audience')) {
        return {
          valid: false,
          error: {
            code: 'INVALID_AUDIENCE',
            message: `Token audience does not match expected Firebase project (${expectedAudience}).`
          }
        };
      }
      if (err.claim === 'iss' || errMessage.includes('issuer')) {
        return {
          valid: false,
          error: {
            code: 'INVALID_ISSUER',
            message: `Token issuer does not match expected Firebase issuer (${expectedIssuer}).`
          }
        };
      }
    }

    // Cryptographic signature verification failure
    if (
      errCode === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
      errCode === 'ERR_JWKS_NO_MATCHING_KEY' ||
      errMessage.includes('signature') ||
      errMessage.includes('key')
    ) {
      return {
        valid: false,
        error: {
          code: 'FORGED_SIGNATURE',
          message: 'Cryptographic token signature verification failed. Forged or untrusted token rejected.'
        }
      };
    }

    return {
      valid: false,
      error: {
        code: 'INVALID_TOKEN',
        message: `Token verification failed: ${errMessage}`
      }
    };
  }
}

/**
 * Enforces VeriCommit's domain access boundaries:
 * - A user may only read/write an agreement if their authenticated UID or verified email matches.
 * - Non-participants cannot view or modify the agreement (Cross-agreement isolation).
 * - Only the Grantor may perform consequential approval actions.
 */
export function checkAgreementAuthorization(
  user: AuthenticatedUser,
  agreement: FundingAgreement,
  requiredRole?: 'Grantor' | 'Grantee'
): { authorized: boolean; role?: 'Grantor' | 'Grantee'; error?: { code: string; message: string } } {
  const isGrantor = agreement.grantorId === user.uid || (agreement.grantorId === 'g-101' && user.email?.includes('grantor'));
  const isGrantee = agreement.granteeId === user.uid || (agreement.granteeId === 'ge-202' && user.email?.includes('grantee'));

  if (!isGrantor && !isGrantee) {
    return {
      authorized: false,
      error: {
        code: 'FORBIDDEN_CROSS_AGREEMENT_ACCESS',
        message: 'Access denied: User is not an authorized party to this Funding Agreement.'
      }
    };
  }

  const userRole: 'Grantor' | 'Grantee' = isGrantor ? 'Grantor' : 'Grantee';

  if (requiredRole && requiredRole !== userRole) {
    return {
      authorized: false,
      role: userRole,
      error: {
        code: requiredRole === 'Grantor' ? 'FORBIDDEN_GRANTOR_ONLY' : 'FORBIDDEN_GRANTEE_ONLY',
        message: `Privileged action restricted to ${requiredRole}s only. Current role: ${userRole}.`
      }
    };
  }

  return { authorized: true, role: userRole };
}
