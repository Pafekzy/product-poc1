# Product Brief  VeriCommit

## 1. Product Overview

**Name:** VeriCommit  
**Tagline:** Fund with Evidence.

VeriCommit helps grantors and grantees establish clear milestone expectations, examine development evidence, and review progress through an AI-assisted workflow.

## 2. Problem Statement

Software grants often depend on milestones, but assessing progress can be difficult when expectations are vague or evidence is scattered across repositories, pull requests, and project updates.

Grantors need a more consistent way to assess reported progress. Grantees need transparent expectations and a fair opportunity to demonstrate their work.

## 3. Target Users

### Grantors and Funding Reviewers
People responsible for reviewing project progress and deciding whether a milestone has been met.

### Grantees and Open-Source Builders
Individuals or teams receiving funding who need to demonstrate progress against agreed outcomes.

## 4. User Needs

Grantors need to:
- Define clear milestone outcomes and acceptance criteria.
- See evidence relevant to those criteria.
- Understand what is supported, missing, or uncertain.
- Retain control over the final decision.

Grantees need to:
- Understand what is expected before work is evaluated.
- Provide relevant repository evidence.
- See why evidence supports or does not support a milestone.
- Identify what additional evidence may be needed.

## 5. Product Promise

VeriCommit organizes milestone expectations and available development evidence into a reviewable report. It helps people make better-informed decisions without pretending that GitHub activity alone proves delivery or quality.

## 6. Core Design Challenge

**How might we make software-grant milestone reviews more transparent, evidence-based, and fair for both grantors and grantees?**

## 7. Core User Journey

1. The grantor proposes a milestone and its expected outcomes.
2. The grantee asks questions or proposes changes if needed.
3. The grantor approves the agreed milestone.
4. The grantee provides a GitHub repository.
5. VeriCommit collects available evidence or uses clearly labelled sample evidence.
6. AI compares the evidence with the agreed acceptance criteria.
7. Both parties can inspect the evaluation report.
8. The grantor makes the final decision.

## 8. Product Principles

- Expectations must be agreed before evaluation.
- Findings must be traceable to available evidence.
- Missing evidence must not automatically be described as missing work.
- Uncertainty must be explicit.
- Commit volume is not a substitute for quality or impact.
- AI must not make the final funding decision.
- Repository permissions and private data must be respected.

## 9. Success Measures

### Human Desirability
- Can grantors understand the basis of an evaluation?
- Can grantees understand what evidence is missing or unclear?
- Does the workflow reduce ambiguity around milestone expectations?

### Technical Feasibility
- Can the team demonstrate the complete workflow reliably?
- Can each important finding link to its supporting evidence?
- Can the demo work using free tools and clearly labelled sample data if needed?

### Economic Viability
- Is the workflow useful enough to justify continued development?
- Can a future version serve multiple grantors and projects without disproportionate operating costs?
- Can the product provide value before paid integrations are introduced?

## 10. MVP Boundary

The hackathon MVP demonstrates milestone definition, GitHub evidence, AI-assisted evaluation, and human review. Automated fund transfers, production-grade grant administration, and live Stellar or Drips integrations are outside the initial scope.
