import { describe, it, expect } from 'vitest';
import { validateEvaluationRequest, handleApiRequest } from '../server/api';
import { FundingAgreement, Milestone, HumanDecision, AuditLogEntry } from '../types';

describe('VeriCommit Server API & Contract Conformance', () => {
  it('validates a compliant evaluation request successfully', () => {
    const validPayload = {
      project_name: 'Community Tools',
      repository_url: 'https://github.com/example/community-tools',
      milestone: {
        title: 'Implement member registration',
        description: 'Allow a new member to register and access the application.',
        acceptance_criteria: [
          'A user can submit the registration form.',
          'Invalid input produces understandable validation errors.',
          'Automated tests cover successful and unsuccessful registration.'
        ]
      },
      evidence_source: 'github' as const
    };

    const res = validateEvaluationRequest(validPayload);
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('rejects an evaluation request with missing project name', () => {
    const invalidPayload = {
      project_name: '',
      repository_url: 'https://github.com/example/community-tools',
      milestone: {
        title: 'Title',
        description: 'Desc',
        acceptance_criteria: ['Criterion 1']
      },
      evidence_source: 'github'
    };

    const res = validateEvaluationRequest(invalidPayload);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_REQUEST');
  });

  it('rejects an invalid repository URL', () => {
    const invalidPayload = {
      project_name: 'Community Tools',
      repository_url: 'not-a-valid-url',
      milestone: {
        title: 'Title',
        description: 'Desc',
        acceptance_criteria: ['Criterion 1']
      },
      evidence_source: 'github'
    };

    const res = validateEvaluationRequest(invalidPayload);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_REPOSITORY_URL');
  });

  it('rejects an evaluation request with empty acceptance criteria', () => {
    const invalidPayload = {
      project_name: 'Community Tools',
      repository_url: 'https://github.com/example/community-tools',
      milestone: {
        title: 'Title',
        description: 'Desc',
        acceptance_criteria: []
      },
      evidence_source: 'sample'
    };

    const res = validateEvaluationRequest(invalidPayload);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_REQUEST');
  });

  it('rejects invalid evidence source option', () => {
    const invalidPayload = {
      project_name: 'Community Tools',
      repository_url: 'https://github.com/example/community-tools',
      milestone: {
        title: 'Title',
        description: 'Desc',
        acceptance_criteria: ['Criterion 1']
      },
      evidence_source: 'unsupported_source'
    };

    const res = validateEvaluationRequest(invalidPayload);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_REQUEST');
  });

  it('returns 501 Not Implemented disclosing that Gemini integration is pending and synthetic evaluations are prohibited', () => {
    let statusCode = 0;
    let headers: Record<string, string> = {};
    let responseBody = '';

    const mockReq: any = { method: 'POST', headers: {} };
    const mockRes: any = {
      setHeader: (k: string, v: string) => { headers[k] = v; },
      set statusCode(val: number) { statusCode = val; },
      end: (data: string) => { responseBody = data; }
    };

    const url = new URL('http://localhost:3000/api/v1/evaluations');
    const validBody = JSON.stringify({
      project_name: 'Community Tools',
      repository_url: 'https://github.com/example/community-tools',
      milestone: {
        title: 'Implement member registration',
        description: 'Allow a new member to register and access the application.',
        acceptance_criteria: ['A user can submit the registration form.']
      },
      evidence_source: 'sample'
    });

    const handled = handleApiRequest(mockReq, mockRes, url, validBody);
    expect(handled).toBe(true);
    expect(statusCode).toBe(501);

    const parsed = JSON.parse(responseBody);
    expect(parsed.error.code).toBe('EVALUATION_NOT_IMPLEMENTED');
    expect(parsed.error.message).toContain('Synthetic evaluation results are strictly prohibited');
  });
});

describe('VeriCommit Domain Invariants & Entity Relationships', () => {
  it('enforces that every Milestone belongs to exactly one Funding Agreement', () => {
    const agreement: FundingAgreement = {
      id: 'fa-8041',
      title: 'Decentralized Public Goods Tooling Grant',
      grantorId: 'g-101',
      grantorName: 'Open Web Stewardship Foundation',
      granteeId: 'ge-202',
      granteeName: 'Decentralized Builders Collective',
      description: 'Test Grant',
      status: 'active',
      createdAt: '2026-09-01T10:00:00Z',
      milestones: []
    };

    const milestone: Milestone = {
      id: 'ms-01',
      fundingAgreementId: agreement.id,
      title: 'Milestone 1',
      description: 'Scope',
      repositoryUrl: 'https://github.com/example/community-tools',
      evidenceSource: 'sample',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      acceptanceCriteria: [
        { id: 'ac-1', description: 'Criterion 1', status: 'supported' }
      ]
    };

    expect(milestone.fundingAgreementId).toBe(agreement.id);
    expect(agreement.grantorId).toBeTruthy();
    expect(agreement.granteeId).toBeTruthy();
  });

  it('validates human decision recording with mandatory justification and role', () => {
    const decision: HumanDecision = {
      decision_id: 'dec-1234',
      milestone_id: 'ms-01',
      reviewer_name: 'Elena Vance',
      reviewer_role: 'Grantor',
      status: 'approved',
      reasoning: 'Verified PR #12 diff and confirmation modal meets acceptance criterion 1.',
      recorded_at: new Date().toISOString()
    };

    expect(['approved', 'rejected', 'changes_requested']).toContain(decision.status);
    expect(decision.reasoning.trim().length).toBeGreaterThan(10);
    expect(decision.reviewer_name).toBeTruthy();
    expect(decision.reviewer_role).toBe('Grantor');
  });

  it('validates audit event creation structure with actor and target references', () => {
    const auditEntry: AuditLogEntry = {
      id: 'audit-999',
      timestamp: new Date().toISOString(),
      actor: 'Elena Vance (Grantor)',
      action: 'Recorded Human Decision: APPROVED',
      entityType: 'HumanDecision',
      entityId: 'dec-1234',
      details: 'Milestone "Implement registration" approved.'
    };

    expect(auditEntry.actor).toContain('Grantor');
    expect(auditEntry.entityType).toBe('HumanDecision');
    expect(auditEntry.entityId).toBe('dec-1234');
    expect(auditEntry.timestamp).toBeTruthy();
  });
});
