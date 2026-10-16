# API Contract  VeriCommit MVP

**Status:** Proposed  backend and frontend leads must review and agree before implementation.

## 1. Purpose

This document defines the proposed request and response between the VeriCommit frontend and backend for evaluating a software-project milestone.

The contract is intentionally small for the hackathon MVP. Both teams should agree on any changes before relying on the interface.

## 2. Evaluation Endpoint

- **Method:** `POST`
- **Path:** `/api/v1/evaluations`
- **Content-Type:** `application/json`

The endpoint evaluates available project evidence against previously agreed milestone acceptance criteria.

## 3. Request

### Example

```json
{
  "project_name": "Community Tools",
  "repository_url": "https://github.com/example/community-tools",
  "milestone": {
    "title": "Implement member registration",
    "description": "Allow a new member to register and access the application.",
    "acceptance_criteria": [
      "A user can submit the registration form.",
      "Invalid input produces understandable validation errors.",
      "Automated tests cover successful and unsuccessful registration."
    ]
  },
  "evidence_source": "github"
}
```

### Fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `project_name` | string | Yes | Human-readable project name |
| `repository_url` | string | Yes | GitHub repository URL |
| `milestone.title` | string | Yes | Agreed milestone title |
| `milestone.description` | string | Yes | Expected outcome |
| `milestone.acceptance_criteria` | string array | Yes | Criteria agreed before evaluation |
| `evidence_source` | string | Yes | `github` or `sample` |

For `evidence_source: "sample"`, the backend must use clearly labelled demonstration evidence rather than pretending to retrieve live GitHub data.

## 4. Response

### Example

```json
{
  "evaluation_id": "eval_demo_001",
  "project_name": "Community Tools",
  "milestone_title": "Implement member registration",
  "overall_summary": "Some evidence supports progress, but not every acceptance criterion is demonstrated.",
  "criteria_results": [
    {
      "criterion": "A user can submit the registration form.",
      "status": "supported",
      "explanation": "A pull request describes the registration form implementation.",
      "evidence": [
        {
          "type": "pull_request",
          "title": "Add registration form",
          "url": "https://github.com/example/community-tools/pull/12"
        }
      ]
    },
    {
      "criterion": "Invalid input produces understandable validation errors.",
      "status": "insufficient_evidence",
      "explanation": "The available repository evidence does not demonstrate the validation behavior.",
      "evidence": []
    },
    {
      "criterion": "Automated tests cover successful and unsuccessful registration.",
      "status": "uncertain",
      "explanation": "Test-related changes are visible, but the available evidence does not establish that both scenarios are covered.",
      "evidence": []
    }
  ],
  "suggested_next_steps": [
    "Provide a demonstration or test result for invalid input.",
    "Review the registration tests for both success and failure cases."
  ],
  "limitations": [
    "Repository activity alone does not prove that the feature works in production."
  ],
  "human_review_required": true
}
```

The URLs and findings in this example are illustrative only; they are not verified project evidence.

## 5. Allowed Criterion Statuses

- `supported`  available evidence supports the criterion.
- `insufficient_evidence`  available evidence does not demonstrate the criterion.
- `uncertain`  evidence exists, but its meaning or sufficiency is unclear.

The absence of evidence must not automatically be interpreted as proof that work was not done.

## 6. Error Responses

Use a consistent error structure.

### Example

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Provide a milestone title and at least one acceptance criterion."
  }
}
```

Suggested error codes:

- `INVALID_REQUEST`  required input is missing or invalid.
- `INVALID_REPOSITORY_URL`  repository URL is invalid or unsupported.
- `REPOSITORY_ACCESS_DENIED`  the application cannot access the repository.
- `EVIDENCE_RETRIEVAL_FAILED`  evidence could not be retrieved.
- `GEMINI_CONFIG_MISSING`  Gemini API key is not configured on the server.
- `GEMINI_TIMEOUT`  Gemini request timed out waiting for upstream response.
- `GEMINI_PROVIDER_ERROR`  Gemini API returned an upstream error.
- `GEMINI_INVALID_OUTPUT`  Gemini returned an empty or malformed JSON response.
- `GEMINI_SCHEMA_VALIDATION_FAILED`  Gemini response failed schema validation.
- `EVALUATION_FAILED`  evaluation could not be completed.

The frontend should display an understandable message and allow the user to recover where possible.

## 7. Evaluation Rules

- Evaluate evidence against the agreed acceptance criteria, not an invented definition of success.
- Include evidence links for factual findings whenever available.
- Do not invent commits, pull requests, test results, or release information.
- Do not treat commit count as a measure of quality.
- Distinguish missing evidence from missing work.
- Make uncertainty and technical limitations visible.
- Require a human reviewer to make the final milestone or funding decision.

## 8. Security and Privacy

- Never expose GitHub access tokens in frontend code or API responses.
- Do not request private-repository access unless it is necessary and authorized.
- Validate repository URLs and all incoming request fields.
- Do not log secrets or unnecessary private repository content.
- Clearly disclose whether evidence came from GitHub or sample data.

## 9. Implementation Agreement

Before implementation, Joshua and Wale should confirm:

1. The endpoint path and request fields.
2. The response schema and criterion status values.
3. How sample evidence is selected.
4. How errors are returned and displayed.
5. Whether the first demo uses live GitHub retrieval, sample evidence, or both.

Any agreed changes should be reflected in this document and communicated to both teams.

---

## 10. Evidence Retrieval Endpoint (Prompt 06)

- **Method:** `GET`
- **Path:** `/api/v1/evidence/github`
- **Authentication:** Required (`Authorization: Bearer <Firebase_ID_Token>`)

### 10.1 Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `repo_url` | string | Yes | GitHub repository URL (`https://github.com/:owner/:repo`) |
| `agreement_id` | string | Yes | Associated Funding Agreement ID (for authorization context) |
| `branch` | string | No | Optional target branch filter |
| `since` | string | No | Optional ISO-8601 timestamp filter |

### 10.2 Supported Repository URL Formats
- `https://github.com/{owner}/{repo}`
- `https://github.com/{owner}/{repo}/` (trailing slash normalized)
- `https://github.com/{owner}/{repo}.git` (`.git` extension normalized)
- `https://github.com/{owner}/{repo}/tree/{branch}` (branch safely extracted)
- `https://github.com/{owner}/{repo}/blob/{branch}` (branch safely extracted)

*Rejected:* non-https protocols, non-`github.com` hosts, custom ports, embedded credentials, path traversal (`..`), or SSRF attempts.

### 10.3 Bounded Retrieval Limits
- Commits: Max 20 recent commits.
- Pull Requests: Max 20 pull requests.

### 10.4 Response Structure

```json
{
  "success": true,
  "repository": {
    "owner": "Pafekzy",
    "repo": "product-poc1",
    "url": "https://github.com/Pafekzy/product-poc1",
    "branch": "main"
  },
  "retrievedAt": "2026-10-16T14:00:00.000Z",
  "provenance": "live",
  "isSample": false,
  "commits": [
    {
      "id": "commit-1e3ae808f3c1a9...",
      "type": "commit",
      "owner": "Pafekzy",
      "repo": "product-poc1",
      "sha": "1e3ae80...",
      "shortSha": "1e3ae80",
      "title": "Refine feature carousel ordering and autoplay",
      "commitMessage": "Refine feature carousel ordering and autoplay\n\nFull description...",
      "url": "https://github.com/Pafekzy/product-poc1/commit/1e3ae80...",
      "author": "alex-dev",
      "authorAvatarUrl": "https://avatars.githubusercontent.com/u/...",
      "committedAt": "2026-10-16T10:00:00Z",
      "provider": "github",
      "retrievedAt": "2026-10-16T14:00:00.000Z",
      "isSample": false
    }
  ],
  "pullRequests": [
    {
      "id": "pr-12",
      "type": "pull_request",
      "owner": "Pafekzy",
      "repo": "product-poc1",
      "number": 12,
      "title": "Add member registration form",
      "state": "merged",
      "isMerged": true,
      "mergedAt": "2026-10-12T10:00:00Z",
      "url": "https://github.com/Pafekzy/product-poc1/pull/12",
      "headBranch": "feature/registration",
      "baseBranch": "main",
      "author": "maria-ui",
      "createdAt": "2026-10-10T10:00:00Z",
      "updatedAt": "2026-10-12T10:00:00Z",
      "provider": "github",
      "retrievedAt": "2026-10-16T14:00:00.000Z",
      "isSample": false
    }
  ],
  "totalCommits": 1,
  "totalPullRequests": 1
}
```

### 10.5 Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid Firebase ID token. |
| `INVALID_REPOSITORY_URL` | 400 | Malformed, non-HTTPS, or non-GitHub repository URL. |
| `AGREEMENT_CONTEXT_REQUIRED` | 400 | `agreement_id` parameter missing. |
| `AGREEMENT_NOT_FOUND` | 404 | Specified Funding Agreement does not exist. |
| `FORBIDDEN_CROSS_AGREEMENT_ACCESS` | 403 | Authenticated user is not an authorized party on the agreement. |
| `UNAUTHORIZED_REPOSITORY_CONTEXT` | 403 | Repository URL is not defined in any milestone of the agreement. |
| `GITHUB_REPO_NOT_FOUND` | 404 | Repository does not exist or is private/inaccessible. |
| `GITHUB_RATE_LIMITED` | 403 | GitHub API rate limit reached. Configure server `GITHUB_TOKEN`. |
| `GITHUB_FORBIDDEN` | 403 | GitHub API rejected request with forbidden error. |
| `GITHUB_TIMEOUT` | 504 | Upstream GitHub API request timed out (8s limit). |
| `GITHUB_NETWORK_ERROR` | 502 | Upstream network failure connecting to `api.github.com`. |

