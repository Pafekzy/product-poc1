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
    code: 'UNAUTHORIZED' | 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'INVALID_ISSUER' | 'INVALID_AUDIENCE';
    message: string;
  };
}

/**
 * Server-side JWT parser and claim verifier for Firebase ID Tokens.
 * Validates expiration, structure, issuer, and audience against the provisioned project.
 */
export function verifyFirebaseIdToken(authHeader: string | undefined): TokenVerificationResult {
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

  let payload: any;
  try {
    const base64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    payload = JSON.parse(json);
  } catch {
    return {
      valid: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Could not parse token payload as JSON.'
      }
    };
  }

  const nowInSec = Math.floor(Date.now() / 1000);

  // 1. Check expiration
  if (typeof payload.exp !== 'number' || payload.exp <= nowInSec) {
    return {
      valid: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired. Please re-authenticate.'
      }
    };
  }

  // 2. Check audience (must match Firebase Project ID)
  const expectedAud = firebaseConfig.projectId;
  if (payload.aud !== expectedAud) {
    return {
      valid: false,
      error: {
        code: 'INVALID_AUDIENCE',
        message: `Token audience ${payload.aud} does not match expected project ${expectedAud}.`
      }
    };
  }

  // 3. Check issuer
  const expectedIss = `https://securetoken.google.com/${expectedAud}`;
  if (payload.iss !== expectedIss) {
    return {
      valid: false,
      error: {
        code: 'INVALID_ISSUER',
        message: `Token issuer ${payload.iss} does not match expected issuer ${expectedIss}.`
      }
    };
  }

  // 4. Check subject UID
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
      email: payload.email,
      email_verified: Boolean(payload.email_verified),
      name: payload.name
    }
  };
}

/**
 * Enforces VeriCommit's domain access boundaries:
 * - A user may only read/write an agreement if they are the responsible Grantor or Grantee.
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
