# VeriCommit Domain Entities Specification

**Document status:** Approved Domain Specification  
**Scope:** VeriCommit Domain Entities, Identities, and Data Relationships  
**Project:** VeriCommit (`Pafekzy/product-poc1`)

---

## 1. Overview and Core Distinction

This document formalizes the definitions, attributes, and relationships of all domain entities within VeriCommit.

A critical design requirement is separating **cryptographic human identity** from **organizational entities and agreement roles**:
- An individual person signs in with an authenticated identity (Firebase Auth UID and verified email).
- An individual person does **not** permanently hold a global "Grantor" or "Grantee" identity across the entire platform.
- A person's role and authorization are determined dynamically per `FundingAgreement`. A user may be an authorized decision-maker for a Grantor on Agreement A, and an authorized Grantee recipient on Agreement B.
- In the current implementation, there is **no separate multi-tenant organization directory table** or organization membership collection. The responsible Grantor and Grantee entities are represented via attributes on the `FundingAgreement` record.

---

## 2. Domain Entities

### 2.1 Authenticated User (`User`)

An individual human actor authenticated through Google OAuth via Firebase Authentication.

- **Implementation Status:** **VERIFIED IMPLEMENTED**
- **Attributes:**
  - `uid` (`string`): Cryptographic subject identifier (`sub`) extracted from the RS256-verified Firebase ID token.
  - `email` (`string`, optional): User's primary email address.
  - `emailVerified` (`boolean`): Cryptographically verified email claim from the identity provider.
  - `displayName` (`string`, optional): User's public display name.
- **Rules & Boundaries:**
  - Authenticated user records are managed by Firebase Authentication and verified server-side via RS256 JWKS validation (`src/server/auth.ts`).
  - An authenticated user has no inherent authority until matched against a `FundingAgreement` participant definition.

### 2.2 Responsible Grantor Entity (`GrantorEntity`)

The institutional organization, foundation, fund, or individual sponsoring the grant and holding formal review and final funding decision authority.

- **Implementation Status:** **VERIFIED IMPLEMENTED (Denormalized on Agreement)**
- **Attributes (persisted on `FundingAgreement`):**
  - `grantorId` (`string`): Unique identifier for the responsible Grantor entity (e.g., `'g-101'`).
  - `grantorName` (`string`): Legal or organizational name of the Grantor (e.g., `'Open Web Stewardship Foundation'`).
  - `grantorEmail` (`string`, optional): Designated contact or authorized email pattern for the Grantor entity.
- **Rules & Boundaries:**
  - Every MVP funding agreement has **exactly one** responsible Grantor entity.
  - Collaborative Grantor consortiums and multi-party joint funding are deferred as future scope.

### 2.3 Authorized Decision-Maker

An authenticated human user who possesses verified authorization to record formal milestone decisions on behalf of the responsible Grantor entity.

- **Implementation Status:** **VERIFIED IMPLEMENTED**
- **Authorization Rule (`src/server/auth.ts` & `firestore.rules`):**
  - A user is recognized as an authorized decision-maker for an agreement if and only if:
    1. `user.uid == agreement.grantorId`, OR
    2. `user.emailVerified == true && agreement.grantorEmail != null && user.email.toLowerCase() == agreement.grantorEmail.toLowerCase()`, OR
    3. Designated demo Grantor override on demo agreement `fa-8041` for authorized developers.
- **Rules & Boundaries:**
  - Grantees, observers, and unrelated users cannot act as authorized decision-makers.
  - The decision-maker's `uid` and name are permanently recorded on the formal `HumanDecision` record.

### 2.4 Grantee Entity (`GranteeEntity`)

The development team, collective, or individual open-source contributor receiving funding and committing to deliver agreed milestones.

- **Implementation Status:** **VERIFIED IMPLEMENTED (Denormalized on Agreement)**
- **Attributes (persisted on `FundingAgreement`):**
  - `granteeId` (`string`): Unique identifier for the Grantee entity or authorized user (e.g., `'ge-202'`).
  - `granteeName` (`string`): Name of the development collective or project team (e.g., `'Decentralized Builders Collective'`).
  - `granteeEmail` (`string`, optional): Designated contact email for the Grantee.
- **Rules & Boundaries:**
  - Every MVP funding agreement has **exactly one** Grantee entity.
  - A Grantee may hold multiple active funding agreements with different Grantors simultaneously.

### 2.5 Funding Agreement (`FundingAgreement`)

The binding record connecting exactly one responsible Grantor entity to exactly one Grantee entity for a defined scope of milestones, budget, and timeline.

- **Implementation Status:** **VERIFIED IMPLEMENTED**
- **Persistence Location:** Cloud Firestore collection `/funding_agreements/{agreementId}`
- **Attributes:**
  - `id` (`string`): Unique agreement identifier (e.g., `'fa-8041'`).
  - `title` (`string`): Human-readable title of the funding agreement.
  - `grantorId` (`string`): Responsible Grantor entity identifier.
  - `grantorName` (`string`): Responsible Grantor organization name.
  - `grantorEmail` (`string`, optional): Responsible Grantor contact email.
  - `granteeId` (`string`): Grantee entity identifier.
  - `granteeName` (`string`): Grantee organization/team name.
  - `granteeEmail` (`string`, optional): Grantee contact email.
  - `description` (`string`): Agreement purpose, scope, and background.
  - `totalCommitment` (`string`, optional): Financial commitment (e.g., `'$45,000 USD'`).
  - `status` (`'active' | 'completed' | 'terminated'`): Agreement lifecycle state.
  - `createdAt` (`string`): ISO-8601 creation timestamp.
  - `milestones` (`Milestone[]`): Subcollection of deliverable milestones.
- **Rules & Boundaries:**
  - Immutable fields protected by database rules: `id`, `grantorId`, `granteeId`, `grantorEmail`, `granteeEmail`, `createdAt`.
  - Only the authorized Grantor may change `status` or `totalCommitment`.

### 2.6 Milestone (`Milestone`)

A distinct deliverable stage or phase within a Funding Agreement, defining agreed acceptance criteria, target dates, and evidence sources.

- **Implementation Status:** **VERIFIED IMPLEMENTED**
- **Persistence Location:** Subcollection `/funding_agreements/{agreementId}/milestones/{milestoneId}`
- **Attributes:**
  - `id` (`string`): Unique milestone identifier (e.g., `'ms-01'`).
  - `fundingAgreementId` (`string`): Parent agreement identifier.
  - `title` (`string`): Milestone title.
  - `description` (`string`): Narrative of expected milestone deliverables.
  - `acceptanceCriteria` (`AcceptanceCriterion[]`): List of atomic verifiable criteria.
  - `repositoryUrl` (`string`, optional): Target GitHub repository URL.
  - `evidenceSource` (`'github' | 'sample'`): Source mode for evaluation evidence.
  - `targetDate` (`string`, optional): Agreed target delivery date (YYYY-MM-DD).
  - `lifecycleState` (`MilestoneLifecycleState`, optional) — **APPROVED DESIGN**:
    `'draft' | 'in_progress' | 'submitted_for_review' | 'approved' | 'rejected' | 'changes_requested'`
  - `evaluationId` (`string`, optional): Reference to the active formal `EvaluationReport`.
  - `humanDecision` (`HumanDecision`, optional): Attached formal Grantor decision record.
  - `createdAt` (`string`): ISO-8601 creation timestamp.
  - `updatedAt` (`string`): ISO-8601 last update timestamp.
- **Rules & Boundaries:**
  - A milestone strictly belongs to **exactly one** Funding Agreement at a time.
  - Only the authorized Grantor may attach or update `humanDecision`.

### 2.7 Acceptance Criterion (`AcceptanceCriterion`)

An explicit, atomic condition agreed between Grantor and Grantee prior to work evaluation.

- **Implementation Status:** **VERIFIED IMPLEMENTED**
- **Attributes:**
  - `id` (`string`): Unique criterion identifier (e.g., `'ac-1'`).
  - `description` (`string`): The verifiable statement of acceptable completion.
  - `status` (`CriterionStatus`):
    `'supported' | 'insufficient_evidence' | 'uncertain' | 'contradicted' | 'human_decision_pending'`
  - `explanation` (`string`, optional): Evaluator rationale or justification.
  - `associatedEvidenceIds` (`string[]`, optional): Linked evidence identifiers.
- **Rules & Boundaries:**
  - Criteria must be agreed upon before formal evaluation.
  - Absence of evidence produces `'insufficient_evidence'`, never assumed non-completion.

### 2.8 AI Evaluation Report (`EvaluationReport`)

An advisory evaluation comparing available evidence (commits, pull requests, test runs) against agreed acceptance criteria.

- **Implementation Status:** **VERIFIED IMPLEMENTED**
- **Persistence Location:** Cloud Firestore collection `/evaluations/{evaluationId}`
- **Attributes:**
  - `evaluation_id` (`string`): Unique report identifier.
  - `agreement_id` (`string`, optional): Parent agreement identifier.
  - `milestone_id` (`string`, optional): Evaluated milestone identifier.
  - `project_name` (`string`): Display project name.
  - `milestone_title` (`string`): Evaluated milestone title.
  - `overall_summary` (`string`): Plain-language summary of findings.
  - `criteria_results` (`CriterionResult[]`): Criterion-by-criterion assessment.
  - `suggested_next_steps` (`string[]`): Recommendations for review or missing evidence.
  - `limitations` (`string[]`): Explicit disclosure of evidence boundaries.
  - `human_review_required` (`boolean`): Mandatory constant (`true`).
  - `evaluated_at` (`string`): ISO-8601 evaluation timestamp.
  - `evidence_source` (`'github' | 'sample'`): Source mode.
  - `evaluationScope` (`'formal' | 'self_assessment'`, optional) — **APPROVED DESIGN**:
    Distinguishes official Grantor review evaluations from Grantee pre-submission checks.
- **Rules & Boundaries:**
  - Snapshot record: updates and deletions are disallowed (`allow update, delete: if false;`).
  - Cannot trigger fund release, approve milestones, or record human decisions.

### 2.9 Human Decision (`HumanDecision`)

The binding formal determination recorded by an authorized representative of the responsible Grantor entity.

- **Implementation Status:** **VERIFIED IMPLEMENTED**
- **Persistence Location:** Cloud Firestore collection `/human_decisions/{decisionId}` and embedded on the `Milestone`.
- **Attributes:**
  - `decision_id` (`string`): Unique decision identifier.
  - `agreement_id` (`string`): Scoped agreement identifier.
  - `milestone_id` (`string`): Target milestone identifier.
  - `evaluation_id` (`string`, optional): Associated evaluation report identifier.
  - `reviewer_name` (`string`): Name of the human reviewer.
  - `reviewer_role` (`'Grantor'`): Role of the decision-maker (must be `'Grantor'`).
  - `reviewer_uid` (`string`, optional): Authenticated UID of the decision-maker.
  - `reviewer_email` (`string`, optional): Verified email of the decision-maker.
  - `status` (`'approved' | 'rejected' | 'changes_requested'`): Formal verdict.
  - `reasoning` (`string`): Written justification (minimum 10 characters required).
  - `recorded_at` (`string`): ISO-8601 timestamp.
- **Rules & Boundaries:**
  - Immutable: cannot be edited or deleted once recorded.
  - Writing is strictly restricted by database rules and server endpoints to authorized Grantor users.

### 2.10 Audit Log Entry (`AuditLogEntry`)

An append-only record tracking significant governance and data events.

- **Implementation Status:** **VERIFIED IMPLEMENTED**
- **Persistence Location:** Cloud Firestore collection `/audit_logs/{logId}`
- **Attributes:**
  - `id` (`string`): Unique audit event identifier.
  - `timestamp` (`string`): ISO-8601 timestamp.
  - `actor` (`string`): Human-readable actor identification.
  - `actor_uid` (`string`, optional): Authenticated caller UID.
  - `action` (`string`): Verb describing the event (e.g., `'Created Milestone'`, `'Recorded Decision'`).
  - `entityType` (`'FundingAgreement' | 'Milestone' | 'Evaluation' | 'HumanDecision' | 'Evidence'`): Target entity type.
  - `entityId` (`string`): Identifier of target entity.
  - `agreementId` (`string`, optional): Scoped agreement identifier.
  - `milestoneId` (`string`, optional): Scoped milestone identifier.
  - `details` (`string`): Descriptive context.
  - `previousState` (`string`, optional): Prior state if transitional.
  - `newState` (`string`, optional): New state if transitional.
- **Rules & Boundaries:**
  - Append-only database rules: `allow update, delete: if false;`.
  - Accessible only to authorized agreement participants.

### 2.11 Grantee Invitation (`GranteeInvitation`) — [PROPOSED — NOT IMPLEMENTED]

A secure authorization token enabling a Grantor to invite an intended Grantee to bind their authenticated identity to an agreement.

- **Implementation Status:** **PROPOSED — APPROVED DESIGN (NOT IMPLEMENTED IN RUNTIME)**
- **Attributes:**
  - `id` (`string`): Unique invitation record identifier.
  - `agreementId` (`string`): Target agreement identifier.
  - `targetEmail` (`string`): Email address of the intended Grantee recipient.
  - `tokenHash` (`string`): SHA-256 hash of the single-use invitation secret.
  - `status` (`'pending' | 'accepted' | 'expired'`): Invitation state.
  - `expiresAt` (`string`): ISO-8601 expiration timestamp (7-day TTL).
  - `createdAt` (`string`): ISO-8601 creation timestamp.
  - `acceptedAt` (`string`, optional): ISO-8601 acceptance timestamp.
  - `acceptedByUid` (`string`, optional): Authenticated UID of accepting user.
- **Rules & Boundaries:**
  - Single-use: transition to `'accepted'` is atomic and irrevocable.
  - Intended recipient verification: accepting user's verified email must match `targetEmail`.
  - Not yet implemented in Firestore rules or API endpoints.

---

## 3. Related Documentation

- [Entity Relationships](ENTITY_RELATIONSHIPS.md)
- [Domain Rules](DOMAIN_RULES.md)
- [Domain Diagrams](DOMAIN_DIAGRAMS.md)
