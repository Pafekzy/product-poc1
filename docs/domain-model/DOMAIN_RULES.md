# VeriCommit Domain Rules & Governance Specification

**Document status:** Approved Domain Rules Specification  
**Scope:** Cardinality, Authorization Boundaries, Milestone Lifecycle, and Assurance Rules  
**Project:** VeriCommit (`Pafekzy/product-poc1`)

---

## 1. Cardinality and Governance Invariants

### Rule 1.1: Single Responsible Grantor Entity per Agreement
- **Implementation Status:** **VERIFIED IMPLEMENTED**
- Every Funding Agreement has **exactly one** responsible Grantor entity (`grantorId`, `grantorName`).
- A Grantor entity may sponsor multiple agreements with different Grantees simultaneously.
- A single agreement must never have multiple responsible Grantors or independent co-signers in the MVP.
- Collaborative Grantor consortiums and joint multi-party voting are explicitly **FUTURE SCOPE — NOT MVP**.

### Rule 1.2: Single Grantee Entity per Agreement
- **Implementation Status:** **VERIFIED IMPLEMENTED**
- Every Funding Agreement has **exactly one** Grantee entity (`granteeId`, `granteeName`).
- A Grantee may participate in multiple funding agreements with different Grantors simultaneously.
- Milestones belonging to one agreement never transfer or leak into another agreement.

### Rule 1.3: Milestone Parentage & Containment
- **Implementation Status:** **VERIFIED IMPLEMENTED**
- Every Milestone belongs to **exactly one** Funding Agreement at a time (`fundingAgreementId`).
- Milestones are stored as direct subcollections under their parent agreement:  
  `/funding_agreements/{agreementId}/milestones/{milestoneId}`.
- Moving or reassigning an approved milestone across agreements is prohibited.

---

## 2. Agreement-Scoped Role Authorization

### Rule 2.1: Dynamic Contextual Authorization
- **Implementation Status:** **VERIFIED IMPLEMENTED**
- User authority is evaluated dynamically per agreement via `checkAgreementAuthorization` (`src/server/auth.ts`):
  - **Grantor:** Authenticated UID matches `grantorId`, or verified email matches `grantorEmail`, or designated demo grantor.
  - **Grantee:** Authenticated UID matches `granteeId`, or verified email matches `granteeEmail`.
  - **Observer / Unauthorized:** Any user who is neither the designated Grantor nor Grantee on that specific agreement.
- An individual person may act as Grantor on Agreement 1 and Grantee on Agreement 2.

### Rule 2.2: Cross-Agreement Access Isolation
- **Implementation Status:** **VERIFIED IMPLEMENTED**
- Unrelated users are rejected with HTTP 403 `FORBIDDEN_CROSS_AGREEMENT_ACCESS`.
- Querying agreements (`/api/v1/agreements`) strictly returns only agreements where the caller is Grantor or Grantee.
- Direct Firestore queries are constrained by database rules requiring participant matching.

### Rule 2.3: Grantor Decision Authority
- **Implementation Status:** **VERIFIED IMPLEMENTED**
- Only the authorized decision-maker for the Grantor entity may record a formal decision (`approved`, `rejected`, `changes_requested`).
- Non-Grantors attempting to call `/api/v1/decisions` are rejected with HTTP 403 `FORBIDDEN_GRANTOR_ONLY`.
- Direct client SDK attempts to write to `/human_decisions` are denied by `firestore.rules` unless `isGrantor(incoming().agreement_id)` evaluates to true.
- A minimum 10-character written reasoning is enforced.

### Rule 2.4: Grantee Deliverable Scoping
- **Implementation Status:** **VERIFIED IMPLEMENTED**
- Grantees can inspect criteria, inspect repository evidence, and view formal evaluation reports.
- Grantees cannot modify agreement commitments, approve milestones, or record formal decisions.

---

## 3. Milestone Lifecycle Rules & Transitions

### Rule 3.1: Approved Lifecycle States
- **Status:** **APPROVED DESIGN — NOT IMPLEMENTED** (Code currently infers status from criteria & decision existence)
- The approved domain lifecycle states for a milestone are:
  1. `draft`: Milestone and criteria being formulated by Grantor.
  2. `in_progress`: Criteria agreed and locked; Grantee performing work.
  3. `submitted_for_review`: Grantee has completed work and submitted repository evidence for formal review.
  4. `approved`: Authorized Grantor has recorded a formal approval decision.
  5. `changes_requested`: Authorized Grantor has recorded a formal decision requiring specific revisions.
  6. `rejected`: Authorized Grantor has recorded a formal rejection decision.

### Rule 3.2: Transition Authorization Matrix

| Initial State | Target State | Triggered By | Authorization Rule | Audit Event Required? | Status |
|---|---|---|---|---|---|
| `draft` | `in_progress` | Grantor | Grantor locks agreed criteria | Yes (`Locked Criteria`) | **APPROVED DESIGN** |
| `in_progress` | `submitted_for_review` | Grantee | Grantee packages evidence | Yes (`Submitted Milestone`) | **APPROVED DESIGN** |
| `submitted_for_review` | `approved` | Grantor | Formal decision recorded | Yes (`Approved Milestone`) | **VERIFIED IMPLEMENTED (via decisions)** |
| `submitted_for_review` | `changes_requested` | Grantor | Formal decision recorded | Yes (`Changes Requested`) | **VERIFIED IMPLEMENTED (via decisions)** |
| `submitted_for_review` | `rejected` | Grantor | Formal decision recorded | Yes (`Rejected Milestone`) | **VERIFIED IMPLEMENTED (via decisions)** |
| `changes_requested` | `in_progress` | Grantee | Explicit Grantee acknowledgment | Yes (`Acknowledged Feedback`) | **APPROVED DESIGN — NOT IMPLEMENTED** |

### Rule 3.3: The `changes_requested` Acknowledgment Invariant
- **Status:** **APPROVED DESIGN — NOT IMPLEMENTED**
- When a Grantor records `changes_requested`, the milestone **must remain** in `changes_requested` until the Grantee explicitly acknowledges the feedback in the UI.
- The acknowledgment action generates an immutable audit log entry: `Acknowledged Review Feedback`.
- Once acknowledged, the milestone transitions back to `in_progress` so the Grantee can push new commits and re-evaluate.

---

## 4. Evaluation Separation: Self-Assessment vs. Formal Evaluation

### Rule 4.1: Distinct Evaluation Scopes
- **Status:** **APPROVED DESIGN — NOT IMPLEMENTED (Core evaluation engine is IMPLEMENTED)**
- **Grantee Self-Assessment (`evaluationScope: 'self_assessment'`):**
  - Triggered by Grantee during `in_progress` state.
  - Strictly advisory to detect evidence gaps and missing test coverage prior to formal submission.
  - Cannot alter milestone lifecycle state, cannot create a `human_decisions` record, and does not pollute formal agreement governance logs.
  - If displayed, visibly watermarked: *"Advisory Pre-Submission Self-Assessment"*.
- **Formal Grantor Evaluation (`evaluationScope: 'formal'`):**
  - Triggered by Grantor during `submitted_for_review` state.
  - Serves as the official evidence evaluation of record supporting the Grantor's formal decision.
  - Linked to `milestone.evaluationId` and recorded in audit logs.

### Rule 4.2: Mandatory Human Review Disclosure
- **Status:** **VERIFIED IMPLEMENTED**
- Every formal AI evaluation report generated by the server must enforce:
  ```json
  "human_review_required": true
  ```
- The AI evaluator is prohibited from declaring a milestone approved, issuing binding decisions, or releasing funds.

### Rule 4.3: Grounded Evidence & Status Constraints
- **Status:** **VERIFIED IMPLEMENTED**
- The evaluator compares evidence strictly against agreed acceptance criteria.
- Allowed criterion statuses are strictly bounded:
  - `supported`: Observable evidence directly demonstrates the criterion.
  - `insufficient_evidence`: Observable evidence does not demonstrate the criterion (missing evidence is not treated as proof of non-performance).
  - `uncertain`: Evidence is ambiguous, conflicting, or inconclusive.
  - `contradicted`: Observable evidence actively conflicts with the criterion.

---

## 5. Security, Assurance & Technical Realities

To maintain engineering integrity, all security claims in VeriCommit must reflect actual technical implementation:

| Security Domain | Inspected Implementation Reality | Permitted Accurate Terminology | Prohibited Inaccurate Terminology |
|---|---|---|---|
| **Authentication** | Google OAuth verified via `jose` RS256 public key verification against Google JWKS (`src/server/auth.ts`). | **"Cryptographically Verified RS256 Tokens"** | Do not claim custom asymmetric key-pair generation per user. |
| **Decisions** | Server endpoint verifies token, checks Grantor authorization, and records `reviewer_uid` in Firestore. | **"Identity-Bound Authorized Decisions"** | Do not claim decisions are "cryptographically signed document artifacts". |
| **Audit Logs** | Client SDK updates and deletes are blocked by `firestore.rules` (`allow update, delete: if false;`). | **"Append-Only Audit Logs Enforced by Database Security Rules"** | Do not claim audit logs are "non-repudiable" or "anchored to a blockchain". |
| **Grantee Onboarding** | Not yet implemented. Future design will use 32-byte secure pseudorandom tokens with SHA-256 hashes. | **"High-Entropy Single-Use Invitation Tokens (Proposed)"** | Do not claim invitations are currently active or implemented. |
| **Cross-Agreement Isolation** | Server API and database rules filter queries strictly to agreement participants. | **"Server-Enforced Agreement Isolation"** | Do not claim isolation relies solely on client-side state. |

---

## 6. Related Documentation

- [Domain Entities](DOMAIN_ENTITIES.md)
- [Entity Relationships](ENTITY_RELATIONSHIPS.md)
- [Domain Diagrams](DOMAIN_DIAGRAMS.md)
- [API Contract](../API_CONTRACT.md)
- [AI Evaluation Rules](../AI_EVALUATION_RULES.md)
