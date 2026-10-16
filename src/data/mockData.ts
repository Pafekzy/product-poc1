import { FundingAgreement, EvaluationReport, AuditLogEntry } from '../types';

export const initialFundingAgreements: FundingAgreement[] = [
  {
    id: 'fa-8041',
    title: 'Decentralized Public Goods Tooling Grant',
    grantorId: 'g-101',
    grantorName: 'Open Web Stewardship Foundation',
    granteeId: 'ge-202',
    granteeName: 'Decentralized Builders Collective',
    description: 'Grant to build open-source evidence and verification tooling for decentralized software milestones.',
    totalCommitment: '$45,000 USD',
    status: 'active',
    createdAt: '2026-09-01T10:00:00Z',
    milestones: [
      {
        id: 'ms-01',
        fundingAgreementId: 'fa-8041',
        title: 'Implement member registration & validation',
        description: 'Deliver user registration workflows, robust input validation, and automated test coverage in repository.',
        repositoryUrl: 'https://github.com/example/community-tools',
        evidenceSource: 'sample',
        targetDate: '2026-10-10',
        createdAt: '2026-09-05T14:30:00Z',
        updatedAt: '2026-10-12T09:15:00Z',
        acceptanceCriteria: [
          {
            id: 'ac-1',
            description: 'A user can submit the registration form and receive account confirmation.',
            status: 'supported',
            explanation: 'Pull request #12 demonstrates complete implementation of registration flow and success confirmation modal.'
          },
          {
            id: 'ac-2',
            description: 'Invalid input produces clear, understandable validation errors preventing submission.',
            status: 'insufficient_evidence',
            explanation: 'Repository evidence does not demonstrate invalid input handling or edge-case boundary checks.'
          },
          {
            id: 'ac-3',
            description: 'Automated test suite covers both successful and unsuccessful registration paths.',
            status: 'uncertain',
            explanation: 'Test files are visible in PR #12, but coverage metrics or CI execution logs for error cases are not established.'
          }
        ],
        evaluationId: 'eval-demo-001'
      },
      {
        id: 'ms-02',
        fundingAgreementId: 'fa-8041',
        title: 'Automated CI test suite & deployment staging',
        description: 'Provide automated continuous integration checks on pull requests and deploy to public preview.',
        repositoryUrl: 'https://github.com/example/community-tools',
        evidenceSource: 'sample',
        targetDate: '2026-11-15',
        createdAt: '2026-09-05T14:30:00Z',
        updatedAt: '2026-09-05T14:30:00Z',
        acceptanceCriteria: [
          {
            id: 'ac-4',
            description: 'GitHub Actions workflow runs linting and unit tests on all pull requests.',
            status: 'human_decision_pending'
          },
          {
            id: 'ac-5',
            description: 'Staging environment updates automatically on merges to main branch.',
            status: 'human_decision_pending'
          }
        ]
      }
    ]
  }
];

export const sampleEvaluationReports: Record<string, EvaluationReport> = {
  'eval-demo-001': {
    evaluation_id: 'eval-demo-001',
    project_name: 'Community Tools',
    milestone_title: 'Implement member registration & validation',
    overall_summary: 'Some evidence supports progress, but not every acceptance criterion is demonstrated. One criterion is supported, one lacks sufficient repository evidence, and test coverage remains uncertain.',
    criteria_results: [
      {
        criterion: 'A user can submit the registration form and receive account confirmation.',
        status: 'supported',
        explanation: 'Pull request #12 introduces registration form component with client submission handlers and confirmation view.',
        evidence: [
          {
            type: 'pull_request',
            title: 'PR #12: Add member registration form and confirmation dialog',
            url: 'https://github.com/example/community-tools/pull/12'
          },
          {
            type: 'commit',
            title: 'commit 8f3c1a9: Wire up user registration API client and confirmation',
            url: 'https://github.com/example/community-tools/commit/8f3c1a9'
          }
        ]
      },
      {
        criterion: 'Invalid input produces clear, understandable validation errors preventing submission.',
        status: 'insufficient_evidence',
        explanation: 'Available repository evidence does not demonstrate validation handling or error UI states.',
        evidence: []
      },
      {
        criterion: 'Automated test suite covers both successful and unsuccessful registration paths.',
        status: 'uncertain',
        explanation: 'Test-related files are present in the repository, but evidence is insufficient to verify that failure cases are asserted.',
        evidence: [
          {
            type: 'commit',
            title: 'commit 4a7e2b1: Add registration test scaffold',
            url: 'https://github.com/example/community-tools/commit/4a7e2b1'
          }
        ]
      }
    ],
    suggested_next_steps: [
      'Provide demonstrations or test execution logs showing invalid input validation.',
      'Review unit tests to verify that negative assertions and error boundaries are tested.',
      'Have the Grantor review the recorded evidence before approving milestone completion.'
    ],
    limitations: [
      'Repository commit activity does not prove feature behavior in a deployed environment.',
      'Sample evidence dataset utilized for verification demonstration.'
    ],
    human_review_required: true,
    evaluated_at: '2026-10-12T09:15:00Z',
    evidence_source: 'sample'
  }
};

export const initialAuditLogs: AuditLogEntry[] = [
  {
    id: 'audit-001',
    timestamp: '2026-09-01T10:00:00Z',
    actor: 'Open Web Stewardship Foundation (Grantor)',
    action: 'Created Funding Agreement',
    entityType: 'FundingAgreement',
    entityId: 'fa-8041',
    details: 'Created Funding Agreement "Decentralized Public Goods Tooling Grant" with total commitment $45,000 USD.'
  },
  {
    id: 'audit-002',
    timestamp: '2026-09-05T14:30:00Z',
    actor: 'Decentralized Builders Collective (Grantee)',
    action: 'Added Milestones',
    entityType: 'Milestone',
    entityId: 'ms-01',
    details: 'Defined Milestone 1 "Implement member registration & validation" with 3 acceptance criteria.'
  },
  {
    id: 'audit-003',
    timestamp: '2026-10-12T09:15:00Z',
    actor: 'AI Evaluation Service',
    action: 'Evaluated Evidence',
    entityType: 'Evaluation',
    entityId: 'eval-demo-001',
    details: 'Completed evaluation of sample evidence against Milestone 1: 1 supported, 1 insufficient evidence, 1 uncertain. Flagged for human review.'
  }
];
