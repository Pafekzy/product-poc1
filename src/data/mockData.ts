import { FundingAgreement, EvaluationReport, AuditLogEntry } from '../types';

export const initialFundingAgreements: FundingAgreement[] = [
  {
    id: 'fa-8041',
    title: 'Decentralized Public Goods Tooling Grant',
    grantorId: 'g-101',
    grantorName: 'Open Web Stewardship Foundation',
    grantorEmail: 'imaginright.dev@gmail.com',
    granteeId: 'ge-202',
    granteeName: 'Decentralized Builders Collective',
    granteeEmail: 'grantee@example.com',
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
      },
      {
        id: 'ms-03',
        fundingAgreementId: 'fa-8041',
        title: 'VeriCommit Live Verification Target',
        description: 'Verify live commits and artifacts in the official product repository Pafekzy/product-poc1.',
        repositoryUrl: 'https://github.com/Pafekzy/product-poc1',
        evidenceSource: 'github',
        targetDate: '2026-10-25',
        createdAt: '2026-10-16T12:00:00Z',
        updatedAt: '2026-10-16T12:00:00Z',
        acceptanceCriteria: [
          {
            id: 'ac-6',
            description: 'Public repository artifacts can be queried and displayed with live provenance.',
            status: 'human_decision_pending'
          }
        ]
      }
    ]
  },
  {
    id: 'fa-9210',
    title: 'Open Web Documentation & Tutorials Grant',
    grantorId: 'g-101',
    grantorName: 'Open Web Stewardship Foundation',
    grantorEmail: 'imaginright.dev@gmail.com',
    granteeId: 'ge-303',
    granteeName: 'TechDocs Community Initiative',
    granteeEmail: 'techdocs@example.com',
    description: 'Grant to author interactive developer guides, verification walkthroughs, and API documentation for decentralized grant recipients.',
    totalCommitment: '$25,000 USD',
    status: 'active',
    createdAt: '2026-09-15T12:00:00Z',
    milestones: [
      {
        id: 'ms-doc-01',
        fundingAgreementId: 'fa-9210',
        title: 'Interactive Verification Guides',
        description: 'Create step-by-step developer documentation for milestone submission.',
        repositoryUrl: 'https://github.com/example/community-docs',
        evidenceSource: 'sample',
        targetDate: '2026-10-30',
        createdAt: '2026-09-15T12:00:00Z',
        updatedAt: '2026-09-15T12:00:00Z',
        acceptanceCriteria: [
          {
            id: 'ac-d1',
            description: 'Documentation portal deployed with milestone guide.',
            status: 'supported',
            explanation: 'Documentation site deployed on staging preview with complete guide.'
          }
        ]
      },
      {
        id: 'ms-doc-02',
        fundingAgreementId: 'fa-9210',
        title: 'API Contract & Security Reference',
        description: 'Publish detailed API specification and security reference for grant verification.',
        repositoryUrl: 'https://github.com/example/community-docs',
        evidenceSource: 'sample',
        targetDate: '2026-11-20',
        createdAt: '2026-09-15T12:00:00Z',
        updatedAt: '2026-09-15T12:00:00Z',
        acceptanceCriteria: [
          {
            id: 'ac-d2',
            description: 'Complete API contract and security documentation published.',
            status: 'human_decision_pending'
          }
        ]
      }
    ]
  },
  {
    id: 'fa-7342',
    title: 'Cross-Chain Settlement & Audit Verification Grant',
    grantorId: 'g-404',
    grantorName: 'Stellar Ecosystem Foundation',
    grantorEmail: 'stellar@grantor.org',
    granteeId: 'ge-202',
    granteeName: 'Decentralized Builders Collective',
    granteeEmail: 'grantee@example.com',
    description: 'Grant to research and develop multi-party audit trails and cross-chain milestone settlement protocols.',
    totalCommitment: '$60,000 USD',
    status: 'active',
    createdAt: '2026-09-20T14:00:00Z',
    milestones: [
      {
        id: 'ms-xchain-01',
        fundingAgreementId: 'fa-7342',
        title: 'Audit Trail Protocol Specification',
        description: 'Design append-only cryptographic audit logs for verification decisions.',
        repositoryUrl: 'https://github.com/example/audit-protocol',
        evidenceSource: 'sample',
        targetDate: '2026-11-10',
        createdAt: '2026-09-20T14:00:00Z',
        updatedAt: '2026-09-20T14:00:00Z',
        acceptanceCriteria: [
          {
            id: 'ac-x1',
            description: 'Formal protocol specification published in repository.',
            status: 'supported',
            explanation: 'Specification document merged in PR #5.'
          }
        ]
      }
    ]
  }
];

export const sampleEvaluationReports: Record<string, EvaluationReport> = {
  'eval-demo-001': {
    evaluation_id: 'eval-demo-001',
    agreement_id: 'fa-8041',
    milestone_id: 'ms-01',
    repository_url: 'https://github.com/example/community-tools',
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
    agreementId: 'fa-8041',
    details: 'Created Funding Agreement "Decentralized Public Goods Tooling Grant" with total commitment $45,000 USD.'
  },
  {
    id: 'audit-002',
    timestamp: '2026-09-05T14:30:00Z',
    actor: 'Decentralized Builders Collective (Grantee)',
    action: 'Added Milestones',
    entityType: 'Milestone',
    entityId: 'ms-01',
    agreementId: 'fa-8041',
    milestoneId: 'ms-01',
    details: 'Defined Milestone 1 "Implement member registration & validation" with 3 acceptance criteria.'
  },
  {
    id: 'audit-003',
    timestamp: '2026-10-12T09:15:00Z',
    actor: 'AI Evaluation Service',
    action: 'Evaluated Evidence',
    entityType: 'Evaluation',
    entityId: 'eval-demo-001',
    agreementId: 'fa-8041',
    milestoneId: 'ms-01',
    details: 'Completed evaluation of sample evidence against Milestone 1: 1 supported, 1 insufficient evidence, 1 uncertain. Flagged for human review.'
  }
];
