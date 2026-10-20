# VeriCommit Domain Diagrams Specification

**Document status:** Approved Domain Diagrams Specification  
**Scope:** UML Architecture, Use Cases, Sequences, and Data Relationships  
**Project:** VeriCommit (`Pafekzy/product-poc1`)

---

## 1. Overview

This document consolidates the complete set of UML diagrams governing VeriCommit's architecture, data relationships, role-specific user journeys, and authorization models.

All diagrams strictly adhere to confirmed governance rules:
- Exactly **one** responsible Grantor entity per Funding Agreement.
- Exactly **one** Grantee entity per Funding Agreement.
- Milestone review and formal decision authority reside exclusively with the responsible Grantor.
- Grantee AI-assisted self-assessment is distinct from formal Grantor review.
- Collaborative Grantors are explicitly documented as **FUTURE SCOPE — NOT MVP**.

---

## 2. UML A — Use-Case Diagram

Depicts role-specific capabilities for Grantors and Grantees alongside shared domain services.

```mermaid
flowchart TD
    subgraph Actors
        G[Grantor / Reviewer]
        GE[Grantee / Builder]
        U[Unauthenticated Visitor]
    end

    subgraph Public Portal [PROPOSED SEPARATION]
        UC_Home[Explore Public Homepage & Value Proposition]
        UC_Auth[Authenticate via Google OAuth]
    end

    subgraph Grantor Workspace [PARTIALLY IMPLEMENTED - REFINING]
        UC_G_Overview[View Portfolio & Review Workload]
        UC_G_CreateAg[Create Funding Agreement]
        UC_G_Invite[Generate Grantee Invitation - PROPOSED]
        UC_G_LockCriteria[Review & Lock Milestone Criteria]
        UC_G_Eval[Run/Inspect Formal AI Evaluation - IMPLEMENTED]
        UC_G_Decide[Record Formal Decision with Rationale - IMPLEMENTED]
        UC_G_Audit[Inspect Agreement Audit History - IMPLEMENTED]
    end

    subgraph Grantee Workspace [PARTIALLY IMPLEMENTED - REFINING]
        UC_GE_Accept[Validate Invitation & Onboard Repo - PROPOSED]
        UC_GE_ViewAg[View Project Agreement & Deliverables]
        UC_GE_SelfEval[Run Private Advisory Self-Assessment - PROPOSED MODE]
        UC_GE_Submit[Submit Milestone for Formal Review - PROPOSED LIFECYCLE]
        UC_GE_Outcome[View Grantor Decision & Feedback - IMPLEMENTED]
    end

    subgraph Shared Capabilities [VERIFIED IMPLEMENTED]
        UC_Evidence[Inspect Verified GitHub Evidence]
        UC_Citations[Inspect Criteria Findings & Limitations]
    end

    U --> UC_Home
    U --> UC_Auth

    G --> UC_G_Overview
    G --> UC_G_CreateAg
    G --> UC_G_Invite
    G --> UC_G_LockCriteria
    G --> UC_G_Eval
    G --> UC_G_Decide
    G --> UC_G_Audit
    G --> UC_Evidence
    G --> UC_Citations

    GE --> UC_GE_Accept
    GE --> UC_GE_ViewAg
    GE --> UC_GE_SelfEval
    GE --> UC_GE_Submit
    GE --> UC_GE_Outcome
    GE --> UC_Evidence
    GE --> UC_Citations
```

---

## 3. UML B — Domain Class Diagram

Represents domain entities, persistence structures, multiplicities, and implementation statuses.

```mermaid
classDiagram
    class User {
        +String uid [Verified Implemented]
        +String email [Verified Implemented]
        +Boolean emailVerified [Verified Implemented]
        +String displayName [Verified Implemented]
    }

    class FundingAgreement {
        +String id [Verified Implemented]
        +String title [Verified Implemented]
        +String grantorId [Verified Implemented]
        +String grantorName [Verified Implemented]
        +String grantorEmail [Verified Implemented]
        +String granteeId [Verified Implemented]
        +String granteeName [Verified Implemented]
        +String granteeEmail [Verified Implemented]
        +String description [Verified Implemented]
        +String totalCommitment [Verified Implemented]
        +AgreementStatus status [Verified Implemented]
        +DateTime createdAt [Verified Implemented]
    }

    class Milestone {
        +String id [Verified Implemented]
        +String fundingAgreementId [Verified Implemented]
        +String title [Verified Implemented]
        +String description [Verified Implemented]
        +String repositoryUrl [Verified Implemented]
        +String evidenceSource [Verified Implemented]
        +Date targetDate [Verified Implemented]
        +MilestoneLifecycleState lifecycleState [PROPOSED]
        +DateTime createdAt [Verified Implemented]
        +DateTime updatedAt [Verified Implemented]
    }

    class AcceptanceCriterion {
        +String id [Verified Implemented]
        +String description [Verified Implemented]
        +CriterionStatus status [Verified Implemented]
        +String explanation [Verified Implemented]
    }

    class GitHubEvidenceItem {
        +String id [Verified Implemented]
        +EvidenceType type [Verified Implemented]
        +String title [Verified Implemented]
        +String url [Verified Implemented]
        +String sha [Verified Implemented]
        +DateTime committedAt [Verified Implemented]
        +String provenance [Verified Implemented]
        +Boolean isSample [Verified Implemented]
    }

    class EvaluationReport {
        +String evaluationId [Verified Implemented]
        +String agreementId [Verified Implemented]
        +String milestoneId [Verified Implemented]
        +EvaluationScope evaluationScope [PROPOSED: formal | self_assessment]
        +String overallSummary [Verified Implemented]
        +List~CriterionResult~ criteriaResults [Verified Implemented]
        +List~String~ limitations [Verified Implemented]
        +Boolean humanReviewRequired [Verified Implemented: true]
        +DateTime evaluatedAt [Verified Implemented]
    }

    class HumanDecision {
        +String decisionId [Verified Implemented]
        +String agreementId [Verified Implemented]
        +String milestoneId [Verified Implemented]
        +String evaluationId [Verified Implemented]
        +String reviewerUid [Verified Implemented]
        +String reviewerName [Verified Implemented]
        +ReviewerRole reviewerRole [Verified Implemented: Grantor]
        +DecisionStatus status [Verified Implemented: approved|rejected|changes_requested]
        +String reasoning [Verified Implemented: min 10 chars]
        +DateTime recordedAt [Verified Implemented]
    }

    class AuditLogEntry {
        +String id [Verified Implemented]
        +DateTime timestamp [Verified Implemented]
        +String actor [Verified Implemented]
        +String actorUid [Verified Implemented]
        +String action [Verified Implemented]
        +String entityType [Verified Implemented]
        +String entityId [Verified Implemented]
        +String agreementId [Verified Implemented]
        +String details [Verified Implemented]
    }

    class GranteeInvitation {
        +String tokenHash [PROPOSED]
        +String agreementId [PROPOSED]
        +String targetEmail [PROPOSED]
        +InvitationState state [PROPOSED: pending|accepted|expired]
        +DateTime expiresAt [PROPOSED]
        +DateTime acceptedAt [PROPOSED]
        +String acceptedByUid [PROPOSED]
    }

    User "1" -- "0..*" FundingAgreement : dynamically authorized participant
    FundingAgreement "1" *-- "1..*" Milestone : strictly owns
    FundingAgreement "1" -- "0..1" GranteeInvitation : authorizes onboarding of Grantee
    FundingAgreement "1" -- "0..*" AuditLogEntry : generates
    Milestone "1" *-- "1..*" AcceptanceCriterion : defines
    Milestone "1" o-- "0..*" GitHubEvidenceItem : links
    Milestone "1" -- "0..*" EvaluationReport : evaluates
    Milestone "1" -- "0..1" HumanDecision : receives formal verdict
```

---

## 4. UML C — Grantor Journey Sequence Diagram

Shows Grantor authentication, portfolio management, milestone review, evidence inspection, formal AI evaluation, and decision recording.

```mermaid
sequenceDiagram
    autonumber
    actor Grantor as Authorized Grantor User
    participant Web as VeriCommit UI
    participant Auth as Firebase Auth
    participant API as Backend Server (/api/v1)
    participant GH as GitHub REST API
    participant AI as Gemini 3.8 Flash
    participant DB as Cloud Firestore

    Note over Grantor,DB: 1. Authentication & Portfolio Loading [IMPLEMENTED]
    Grantor->>Web: Click "Sign in with Google"
    Web->>Auth: Authenticate & receive RS256 token
    Web->>API: GET /api/v1/agreements (Bearer Token)
    API->>DB: Query agreements where grantorId == uid
    DB-->>API: Return authorized agreements
    API-->>Web: Render Grantor Portfolio Dashboard

    Note over Grantor,DB: 2. Agreement Creation & Invitation [PROPOSED]
    Grantor->>Web: Create Agreement (title, commitment, granteeEmail)
    Web->>DB: Create /funding_agreements/{id}
    Grantor->>Web: Click "Generate Grantee Invite"
    Web->>API: POST /api/v1/invitations
    API->>DB: Store /invitations/{tokenHash} (TTL: 7d)
    API-->>Web: Display secure invite link

    Note over Grantor,DB: 3. Milestone Review & Formal Evaluation [IMPLEMENTED]
    Grantor->>Web: Open Milestone in 'submitted_for_review' state
    Web->>API: GET /api/v1/evidence/github?repo_url=...&agreement_id=fa-8041
    API->>GH: Fetch recent commits and merged PRs (max 20 each)
    GH-->>API: Return evidence payload
    API-->>Web: Display verified source evidence
    Grantor->>Web: Click "Run Formal Evaluation"
    Web->>API: POST /api/v1/evaluations (mode: 'formal')
    API->>AI: Server-side Gemini evaluation against criteria
    AI-->>API: Grounded JSON response
    API->>DB: Store /evaluations/{id}
    API-->>Web: Render Evaluation Report (human_review_required: true)

    Note over Grantor,DB: 4. Formal Decision Recording [IMPLEMENTED]
    Grantor->>Web: Submit Decision: 'approved', reasoning >= 10 chars
    Web->>API: POST /api/v1/decisions
    API->>API: checkAgreementAuthorization(uid, agreement, 'Grantor')
    API->>DB: Store /human_decisions/{id} (Rules enforce Grantor UID)
    API->>DB: Store /audit_logs/{id}
    API-->>Web: Confirmation
    Web-->>Grantor: Display approved badge & updated audit trail
```

---

## 5. UML D — Grantee Journey Sequence Diagram

Shows Grantee invitation redemption, milestone inspection, private self-assessment, formal submission, and decision feedback.

```mermaid
sequenceDiagram
    autonumber
    actor Grantee as Authorized Grantee User
    participant Web as VeriCommit UI
    participant Auth as Firebase Auth
    participant API as Backend Server (/api/v1)
    participant GH as GitHub REST API
    participant AI as Gemini 3.8 Flash
    participant DB as Cloud Firestore

    Note over Grantee,DB: 1. Secure Onboarding via Invitation [PROPOSED]
    Grantee->>Web: Open Invitation Link (/invite?token=sec_abc123)
    Grantee->>Web: Sign in with Google (OAuth)
    Web->>Auth: Authenticate
    Web->>API: POST /api/v1/invitations/accept (token, repoUrl)
    API->>API: Validate token not expired & email matches targetEmail
    API->>DB: Transaction: set agreement.granteeId = uid; mark invite accepted
    DB-->>API: Success
    API-->>Web: Route directly to Grantee Project Workspace

    Note over Grantee,DB: 2. Delivery & Private Self-Assessment [PROPOSED MODE]
    Grantee->>Web: View locked acceptance criteria & target dates
    Grantee->>Web: Inspect repository evidence (/api/v1/evidence/github)
    API->>GH: Fetch live commits/PRs
    GH-->>API: Return evidence
    Grantee->>Web: Click "Run Advisory Self-Assessment"
    Web->>API: POST /api/v1/evaluations (mode: 'self_assessment')
    API->>AI: Evaluate criteria against evidence
    AI-->>API: Return findings
    API-->>Web: Render Self-Assessment Report (Advisory Only)
    Note over Grantee,Web: Grantee sees Criterion 2 is "insufficient_evidence".<br/>Pushes additional tests to GitHub before formal submission.

    Note over Grantee,DB: 3. Milestone Submission & Outcome Inspection [IMPLEMENTED / PROPOSED]
    Grantee->>Web: Click "Submit Milestone for Formal Review"
    Web->>DB: Update milestone lifecycleState -> 'submitted_for_review'
    Note over Grantee,Web: Grantor conducts formal review...
    Grantee->>Web: View Milestone Details / Realtime Firestore Sync
    DB-->>Web: Realtime update with /human_decisions/{id}
    Web-->>Grantee: Display formal decision ('approved') and Grantor rationale
```

---

## 6. UML E — Authorization and Decision Sequence Diagram

Shows server-side enforcement blocking unauthorized actions and cross-agreement tampering.

```mermaid
sequenceDiagram
    autonumber
    actor Grantee as Authenticated Grantee (ge-202)
    actor Attacker as Foreign Attacker (stranger-999)
    participant API as /api/v1/decisions
    participant Auth as Token Verifier
    participant Store as Agreement Store
    participant DB as Cloud Firestore Rules

    Note over Grantee,API: Case 1: Grantee attempts to record formal Grantor decision
    Grantee->>API: POST /api/v1/decisions (Bearer ge-202 token, status: 'approved')
    API->>Auth: verifyFirebaseIdToken(token)
    Auth-->>API: Verified (uid: 'ge-202')
    API->>Store: getAuthoritativeAgreement('fa-8041')
    Store-->>API: Agreement found (grantorId: 'g-101', granteeId: 'ge-202')
    API->>API: checkAgreementAuthorization(user, agreement, 'Grantor')
    Note right of API: Caller role is 'Grantee'. Required role is 'Grantor'.
    API-->>Grantee: HTTP 403 Forbidden { code: 'FORBIDDEN_GRANTOR_ONLY' }

    Note over Attacker,API: Case 2: Unrelated user attempts cross-agreement access
    Attacker->>API: POST /api/v1/decisions (Bearer stranger-999 token, agreement: 'fa-8041')
    API->>Auth: verifyFirebaseIdToken(token)
    Auth-->>API: Verified (uid: 'stranger-999')
    API->>Store: getAuthoritativeAgreement('fa-8041')
    API->>API: checkAgreementAuthorization(user, agreement)
    Note right of API: Caller is neither grantorId nor granteeId.
    API-->>Attacker: HTTP 403 Forbidden { code: 'FORBIDDEN_CROSS_AGREEMENT_ACCESS' }

    Note over Grantee,DB: Case 3: Grantee attempts direct Firestore client SDK bypass
    Grantee->>DB: db.collection('human_decisions').doc('dec-99').set({...})
    DB->>DB: Evaluate firestore.rules: isGrantor(incoming().agreement_id)
    Note right of DB: request.auth.uid ('ge-202') != agreement.grantorId ('g-101').
    DB-->>Grantee: FirebaseError: Missing or insufficient permissions
```

---

## 7. UML F — Future Collaborative-Grantor Concept (FUTURE SCOPE — NOT MVP)

Explicitly documents the architecture required if independent Grantor organizations associate in future releases.

```mermaid
flowchart TD
    subgraph FUTURE_SCOPE [FUTURE SCOPE — NOT MVP: Collaborative Grantor Consortium]
        subgraph Participating Organizations
            OrgA[Grantor Foundation A<br/>Member Lead & Reviewer]
            OrgB[Grantor Foundation B<br/>Member Lead & Reviewer]
        end

        subgraph Formally Defined Consortium Entity
            Charter[Consortium Governance Charter:<br/>1. Multi-signature Approval Threshold: 2/2<br/>2. Disagreement & Escrow Tie-break Rules<br/>3. Independent Scoped Visibility]
            ConsortiumId[Entity ID: cg-consortium-101]
        end

        subgraph Agreement Scope
            Agreement[Funding Agreement fa-collab-01<br/>Responsible Grantor Entity: cg-consortium-101]
            MilestoneM1[Milestone 1: Joint Deliverable]
        end

        subgraph Recipient
            GranteeRecipient[Grantee Builder Collective]
        end

        OrgA -.-> Charter
        OrgB -.-> Charter
        Charter --> ConsortiumId
        ConsortiumId ==>|Single Responsible Entity Binding| Agreement
        Agreement --> MilestoneM1
        MilestoneM1 --> GranteeRecipient
    end

    style FUTURE_SCOPE fill:#FFF8E6,stroke:#8C5E00,stroke-width:2px,stroke-dasharray: 5 5
```

---

## 8. Related Documentation

- [Domain Entities](DOMAIN_ENTITIES.md)
- [Domain Rules](DOMAIN_RULES.md)
- [Entity Relationships](ENTITY_RELATIONSHIPS.md)
