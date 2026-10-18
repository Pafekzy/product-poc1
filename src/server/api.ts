import type { IncomingMessage, ServerResponse } from 'http';
import { verifyFirebaseIdToken, checkAgreementAuthorization } from './auth';
import { HumanDecision } from '../types';
import { getAuthoritativeAgreement, getAuthoritativeAgreementsForUser } from './agreementStore';
import type { JWTVerifyGetKey } from 'jose';
import { parseGithubRepoUrl, fetchGithubEvidence } from './github';
import { evaluateMilestone } from './evaluator';

export interface EvaluationRequest {
  agreement_id?: string;
  milestone_id?: string;
  project_name: string;
  repository_url: string;
  milestone: {
    id?: string;
    title: string;
    description: string;
    acceptance_criteria: string[];
  };
  evidence_source: 'github' | 'sample';
}

export interface DecisionRequest {
  agreement_id: string;
  milestone_id: string;
  evaluation_id?: string;
  status: 'approved' | 'rejected' | 'changes_requested';
  reasoning: string;
}

export interface ValidationErrorResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export function validateEvaluationRequest(body: any): ValidationErrorResult {
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'Request body must be a JSON object.' }
    };
  }

  if (!body.project_name || typeof body.project_name !== 'string' || body.project_name.trim().length === 0) {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'project_name is required and must be a non-empty string.' }
    };
  }

  if (!body.repository_url || typeof body.repository_url !== 'string') {
    return {
      valid: false,
      error: { code: 'INVALID_REPOSITORY_URL', message: 'repository_url is required.' }
    };
  }

  try {
    new URL(body.repository_url);
  } catch {
    return {
      valid: false,
      error: { code: 'INVALID_REPOSITORY_URL', message: 'repository_url must be a valid URL.' }
    };
  }

  if (!body.milestone || typeof body.milestone !== 'object') {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'milestone object is required.' }
    };
  }

  if (!body.milestone.title || typeof body.milestone.title !== 'string' || body.milestone.title.trim().length === 0) {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'milestone.title is required.' }
    };
  }

  if (!Array.isArray(body.milestone.acceptance_criteria) || body.milestone.acceptance_criteria.length === 0) {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'milestone.acceptance_criteria must be a non-empty array.' }
    };
  }

  if (body.evidence_source !== 'github' && body.evidence_source !== 'sample') {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'evidence_source must be either "github" or "sample".' }
    };
  }

  return { valid: true };
}

export function validateDecisionRequest(body: any): ValidationErrorResult {
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'Request body must be a JSON object.' }
    };
  }

  if (!body.agreement_id || typeof body.agreement_id !== 'string' || body.agreement_id.trim().length === 0) {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'agreement_id is required.' }
    };
  }

  if (!body.milestone_id || typeof body.milestone_id !== 'string' || body.milestone_id.trim().length === 0) {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'milestone_id is required.' }
    };
  }

  if (!['approved', 'rejected', 'changes_requested'].includes(body.status)) {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'status must be "approved", "rejected", or "changes_requested".' }
    };
  }

  if (!body.reasoning || typeof body.reasoning !== 'string' || body.reasoning.trim().length < 10) {
    return {
      valid: false,
      error: { code: 'INVALID_REQUEST', message: 'Explicit justification and reasoning (minimum 10 characters) is required.' }
    };
  }

  return { valid: true };
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  rawBody: string,
  customKeySet?: JWTVerifyGetKey,
  customFetchFn?: typeof fetch,
  customAiClient?: any
): Promise<boolean> {
  res.setHeader('Content-Type', 'application/json');

  // Public Healthcheck
  if (url.pathname === '/api/v1/health' && req.method === 'GET') {
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), persistence: 'firestore' }));
    return true;
  }

  // Protected: Agreement Listing for Authenticated User
  if (url.pathname === '/api/v1/agreements' && req.method === 'GET') {
    const authHeader = req.headers['authorization'];
    const authResult = await verifyFirebaseIdToken(authHeader, customKeySet);

    if (!authResult.valid || !authResult.user) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: authResult.error }));
      return true;
    }

    const rawToken = authHeader?.split(' ')[1];
    const authorizedAgreements = await getAuthoritativeAgreementsForUser(
      authResult.user,
      rawToken,
      customFetchFn
    );

    if (authorizedAgreements === null) {
      res.statusCode = 502;
      res.end(JSON.stringify({
        error: {
          code: 'PERSISTENCE_UNAVAILABLE',
          message: 'Authoritative funding agreement data could not be retrieved from Firestore.'
        }
      }));
      return true;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      agreements: authorizedAgreements.map(item => ({
        ...item.agreement,
        userRole: item.role
      })),
      total: authorizedAgreements.length,
      userId: authResult.user.uid
    }));
    return true;
  }

  // Protected: Agreement Retrieval
  if (url.pathname.startsWith('/api/v1/agreements/') && req.method === 'GET') {
    const agreementId = url.pathname.replace('/api/v1/agreements/', '').trim();
    const authHeader = req.headers['authorization'];
    const authResult = await verifyFirebaseIdToken(authHeader, customKeySet);

    if (!authResult.valid || !authResult.user) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: authResult.error }));
      return true;
    }

    const rawToken = authHeader?.split(' ')[1];
    const agreement = await getAuthoritativeAgreement(agreementId, rawToken, customFetchFn);
    if (!agreement) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { code: 'AGREEMENT_NOT_FOUND', message: `Agreement ${agreementId} not found.` } }));
      return true;
    }

    const access = checkAgreementAuthorization(authResult.user, agreement);
    if (!access.authorized) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: access.error }));
      return true;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ agreement, accessRole: access.role }));
    return true;
  }

  // Protected: Human Decision Recording
  if (url.pathname === '/api/v1/decisions' && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    const authResult = await verifyFirebaseIdToken(authHeader, customKeySet);

    if (!authResult.valid || !authResult.user) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: authResult.error }));
      return true;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Malformed JSON payload.' } }));
      return true;
    }

    const valResult = validateDecisionRequest(parsed);
    if (!valResult.valid && valResult.error) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: valResult.error }));
      return true;
    }

    const rawToken = authHeader?.split(' ')[1];
    const agreement = await getAuthoritativeAgreement(parsed.agreement_id, rawToken, customFetchFn);
    if (!agreement) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { code: 'AGREEMENT_NOT_FOUND', message: `Agreement ${parsed.agreement_id} not found.` } }));
      return true;
    }

    // Verify milestone belongs to the designated agreement
    const milestoneInAgreement = agreement.milestones.some(m => m.id === parsed.milestone_id);
    if (!milestoneInAgreement) {
      res.statusCode = 400;
      res.end(JSON.stringify({
        error: {
          code: 'MILESTONE_NOT_IN_AGREEMENT',
          message: `Milestone ${parsed.milestone_id} does not belong to agreement ${parsed.agreement_id}.`
        }
      }));
      return true;
    }

    // ENFORCE GRANTOR ROLE: Only Grantor may record human decisions
    const access = checkAgreementAuthorization(authResult.user, agreement, 'Grantor');
    if (!access.authorized) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: access.error }));
      return true;
    }

    const recordedDecision: HumanDecision = {
      decision_id: `dec-${Date.now()}`,
      agreement_id: parsed.agreement_id,
      milestone_id: parsed.milestone_id,
      evaluation_id: parsed.evaluation_id,
      reviewer_name: authResult.user.name || authResult.user.email || 'Authorized Grantor',
      reviewer_role: 'Grantor',
      reviewer_uid: authResult.user.uid,
      reviewer_email: authResult.user.email,
      status: parsed.status,
      reasoning: parsed.reasoning,
      recorded_at: new Date().toISOString()
    };

    res.statusCode = 201;
    res.end(JSON.stringify({
      success: true,
      decision: recordedDecision,
      authorized_reviewer_uid: authResult.user.uid
    }));
    return true;
  }

  // Protected / Contract-Conforming: Evaluations Endpoint
  if (url.pathname === '/api/v1/evaluations' && req.method === 'POST') {
    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Malformed JSON payload.' } }));
      return true;
    }

    const validation = validateEvaluationRequest(parsed);
    if (!validation.valid && validation.error) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: validation.error }));
      return true;
    }

    const authHeader = req.headers['authorization'];
    const isRealAgreement = Boolean(
      parsed.agreement_id &&
      typeof parsed.agreement_id === 'string' &&
      parsed.agreement_id.trim().length > 0
    );
    const isLiveGithub = parsed.evidence_source === 'github';

    // Rule: Live GitHub evidence evaluation strictly requires an established agreement context
    if (isLiveGithub && !isRealAgreement) {
      res.statusCode = 400;
      res.end(JSON.stringify({
        error: {
          code: 'AGREEMENT_CONTEXT_REQUIRED',
          message: 'Field "agreement_id" is required to establish authorized repository context for live evaluations.'
        }
      }));
      return true;
    }

    let authenticatedUser: any = null;

    // Rule A: For evaluations involving real agreements (or live GitHub source), authentication is MANDATORY.
    if (isRealAgreement || isLiveGithub) {
      if (!authHeader) {
        res.statusCode = 401;
        res.end(JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or malformed Authorization header. Expected format: Bearer <token>'
          }
        }));
        return true;
      }

      const authResult = await verifyFirebaseIdToken(authHeader, customKeySet);
      if (!authResult.valid || !authResult.user) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: authResult.error }));
        return true;
      }
      authenticatedUser = authResult.user;
    } else if (authHeader) {
      // If auth header is provided in demo/sample mode, verify it
      const authResult = await verifyFirebaseIdToken(authHeader, customKeySet);
      if (!authResult.valid || !authResult.user) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: authResult.error }));
        return true;
      }
      authenticatedUser = authResult.user;
    }

    let evaluationMode: 'gemini' | 'deterministic' | undefined = undefined;
    let fallbackReason: string | undefined = undefined;

    // Rule B & C: Enforce Agreement Authorization, Milestone Membership, and Repository Matching
    if (isRealAgreement) {
      const rawToken = authHeader?.split(' ')[1];
      const agreement = await getAuthoritativeAgreement(parsed.agreement_id, rawToken, customFetchFn);

      if (!agreement) {
        res.statusCode = 404;
        res.end(JSON.stringify({
          error: {
            code: 'AGREEMENT_NOT_FOUND',
            message: `Funding Agreement "${parsed.agreement_id}" not found.`
          }
        }));
        return true;
      }

      // Verify caller is an authorized party on this agreement (Grantor or Grantee)
      const access = checkAgreementAuthorization(authenticatedUser, agreement);
      if (!access.authorized) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: access.error }));
        return true;
      }

      // Verify requested milestone belongs to the authoritative agreement
      const targetMilestoneId = parsed.milestone_id || parsed.milestone?.id;
      const targetMilestone = targetMilestoneId
        ? agreement.milestones.find((m) => m.id === targetMilestoneId)
        : null;

      if (!targetMilestone) {
        res.statusCode = 400;
        res.end(JSON.stringify({
          error: {
            code: 'MILESTONE_NOT_IN_AGREEMENT',
            message: `Milestone "${targetMilestoneId || 'unspecified'}" does not belong to agreement "${parsed.agreement_id}".`
          }
        }));
        return true;
      }

      // Parse and validate repository URL
      let parsedReqRepo;
      try {
        parsedReqRepo = parseGithubRepoUrl(parsed.repository_url);
      } catch (err: any) {
        res.statusCode = err.status || 400;
        res.end(JSON.stringify({
          error: {
            code: err.code || 'INVALID_REPOSITORY_URL',
            message: err.message || 'Invalid repository URL.'
          }
        }));
        return true;
      }

      // Verify repository matches the milestone's repositoryUrl or agreement milestone repository
      let repoMatches = false;
      if (targetMilestone.repositoryUrl) {
        try {
          const parsedMilestoneRepo = parseGithubRepoUrl(targetMilestone.repositoryUrl);
          if (parsedMilestoneRepo.normalizedUrl.toLowerCase() === parsedReqRepo.normalizedUrl.toLowerCase()) {
            repoMatches = true;
          }
        } catch {
          // ignore parsing error on milestone repo
        }
      } else {
        // Fallback: verify repo is associated with any milestone in the agreement
        repoMatches = agreement.milestones.some((m) => {
          if (!m.repositoryUrl) return false;
          try {
            const p = parseGithubRepoUrl(m.repositoryUrl);
            return p.normalizedUrl.toLowerCase() === parsedReqRepo.normalizedUrl.toLowerCase();
          } catch {
            return false;
          }
        });
      }

      if (!repoMatches) {
        res.statusCode = 403;
        res.end(JSON.stringify({
          error: {
            code: 'UNAUTHORIZED_REPOSITORY_CONTEXT',
            message: `Repository "${parsedReqRepo.normalizedUrl}" is not associated with milestone "${targetMilestone.id}" or agreement "${agreement.id}".`
          }
        }));
        return true;
      }
    } else {
      // Standalone sample/demo evaluation (no agreement_id)
      // Abuse control: Unauthenticated public requests cannot trigger live Gemini API calls
      if (!authenticatedUser && !customAiClient) {
        evaluationMode = 'deterministic';
        fallbackReason = 'Unauthenticated demonstration mode (deterministic evaluation)';
      }
    }

    try {
      const evaluation = await evaluateMilestone({
        project_name: parsed.project_name,
        repository_url: parsed.repository_url,
        agreement_id: parsed.agreement_id,
        milestone_id: parsed.milestone_id || parsed.milestone?.id,
        milestone: parsed.milestone,
        evidence_source: parsed.evidence_source,
        fetchFn: customFetchFn,
        aiClient: customAiClient,
        mode: evaluationMode,
        fallbackReason
      });

      res.statusCode = 200;
      res.end(JSON.stringify(evaluation));
      return true;
    } catch (err: any) {
      res.statusCode = err.status || 500;
      res.end(JSON.stringify({
        error: {
          code: err.code || 'EVALUATION_FAILED',
          message: err.message || 'Evaluation failed against provided evidence.'
        }
      }));
      return true;
    }
  }

  // Protected: GitHub Evidence Retrieval (Prompt 06)
  if (url.pathname === '/api/v1/evidence/github' && req.method === 'GET') {
    const authHeader = req.headers['authorization'];
    const authResult = await verifyFirebaseIdToken(authHeader, customKeySet);

    if (!authResult.valid || !authResult.user) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: authResult.error }));
      return true;
    }

    const repoUrl = url.searchParams.get('repo_url');
    if (!repoUrl) {
      res.statusCode = 400;
      res.end(JSON.stringify({
        error: {
          code: 'INVALID_REPOSITORY_URL',
          message: 'Query parameter "repo_url" is required.'
        }
      }));
      return true;
    }

    // Authorization & Context Enforcement:
    // User must supply agreement_id establishing the authorized agreement context
    const agreementId = url.searchParams.get('agreement_id');
    if (!agreementId) {
      res.statusCode = 400;
      res.end(JSON.stringify({
        error: {
          code: 'AGREEMENT_CONTEXT_REQUIRED',
          message: 'Query parameter "agreement_id" is required to establish authorized repository context.'
        }
      }));
      return true;
    }

    const rawToken = authHeader?.split(' ')[1];
    const agreement = await getAuthoritativeAgreement(agreementId, rawToken, customFetchFn);
    if (!agreement) {
      res.statusCode = 404;
      res.end(JSON.stringify({
        error: {
          code: 'AGREEMENT_NOT_FOUND',
          message: `Funding Agreement "${agreementId}" not found.`
        }
      }));
      return true;
    }

    // Verify user is an authorized party on this agreement (Grantor or Grantee)
    const access = checkAgreementAuthorization(authResult.user, agreement);
    if (!access.authorized) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: access.error }));
      return true;
    }

    // Parse and validate repo URL syntax and host security
    let parsedRepo;
    try {
      parsedRepo = parseGithubRepoUrl(repoUrl);
    } catch (err: any) {
      res.statusCode = err.status || 400;
      res.end(JSON.stringify({
        error: {
          code: err.code || 'INVALID_REPOSITORY_URL',
          message: err.message || 'Invalid repository URL.'
        }
      }));
      return true;
    }

    // Verify repository is associated with the agreement or one of its milestones
    const isRepoInAgreement = agreement.milestones.some((m) => {
      if (!m.repositoryUrl) return false;
      try {
        const parsedM = parseGithubRepoUrl(m.repositoryUrl);
        return parsedM.normalizedUrl.toLowerCase() === parsedRepo.normalizedUrl.toLowerCase();
      } catch {
        return false;
      }
    });

    if (!isRepoInAgreement) {
      res.statusCode = 403;
      res.end(JSON.stringify({
        error: {
          code: 'UNAUTHORIZED_REPOSITORY_CONTEXT',
          message: `Repository "${parsedRepo.normalizedUrl}" is not associated with Funding Agreement "${agreementId}".`
        }
      }));
      return true;
    }

    const branch = url.searchParams.get('branch') || undefined;
    const since = url.searchParams.get('since') || undefined;

    const githubToken =
      process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim().length >= 20
        ? process.env.GITHUB_TOKEN.trim()
        : undefined;

    try {
      const evidence = await fetchGithubEvidence({
        repoUrl,
        branch,
        since,
        token: githubToken,
        fetchFn: customFetchFn || fetch
      });

      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        ...evidence
      }));
      return true;
    } catch (err: any) {
      res.statusCode = err.status || 500;
      res.end(JSON.stringify({
        error: {
          code: err.code || 'EVIDENCE_RETRIEVAL_FAILED',
          message: err.message || 'Failed to retrieve GitHub evidence.'
        }
      }));
      return true;
    }
  }

  return false;
}
