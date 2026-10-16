import type { IncomingMessage, ServerResponse } from 'http';

export interface EvaluationRequest {
  project_name: string;
  repository_url: string;
  milestone: {
    title: string;
    description: string;
    acceptance_criteria: string[];
  };
  evidence_source: 'github' | 'sample';
}

export interface ApiErrorDetail {
  code: string;
  message: string;
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

export function handleApiRequest(req: IncomingMessage, res: ServerResponse, url: URL, rawBody: string) {
  res.setHeader('Content-Type', 'application/json');

  if (url.pathname === '/api/v1/health' && req.method === 'GET') {
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), persistence: 'firestore' }));
    return true;
  }

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

    // Explicitly return not-implemented rather than synthesizing AI assessment
    res.statusCode = 501;
    res.end(JSON.stringify({
      error: {
        code: 'EVALUATION_NOT_IMPLEMENTED',
        message: 'Live AI evaluation via Gemini API is pending server-side model configuration. Synthetic evaluation results are strictly prohibited by VeriCommit evaluation rules.'
      },
      validation_passed: true,
      project_name: parsed.project_name,
      milestone_title: parsed.milestone.title,
      criteria_count: parsed.milestone.acceptance_criteria.length,
      evidence_source: parsed.evidence_source
    }));
    return true;
  }

  return false;
}
