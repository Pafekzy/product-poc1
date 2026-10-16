# VeriCommit --- Product Vision and Principles

**Tagline:** Fund with Evidence.\
**Document status:** Foundational product direction\
**Applies to:** Product discovery, design, engineering, AI behavior,
evaluation, and future integrations

------------------------------------------------------------------------

## 1. Product Vision

**A world where commitments attached to funding are clear, progress is
supported by evidence, and every party can understand how decisions are
made.**

VeriCommit aims to strengthen trust between people and organizations
that provide resources and the people and teams entrusted to turn those
resources into meaningful outcomes.

The long-term vision is not merely to monitor developers. It is to make
commitments, evidence, decisions, and follow-through easier to
understand across the lifecycle of a funded project. The product begins
with a focused problem---assessing grantee progress against agreed
software milestones---and may expand over time to support broader,
mutual accountability.

## 2. Product Mission

VeriCommit helps grantors and grantees establish clear milestone
expectations, assess available project evidence against those
expectations, and make more informed decisions through transparent,
AI-assisted reviews and human accountability.

## 3. What VeriCommit Is

**VeriCommit is an AI-powered grant management and milestone
verification tool that helps grantors and grantees track funded software
projects, evaluate GitHub contributions against agreed milestones, and
make evidence-based funding decisions.**

The name combines the ideas of *verification* and *commitment*:

-   **Commitment:** What the parties agree should happen, including a
    grantee's promised milestone and its acceptance criteria.
-   **Evidence:** What can be observed or provided to show progress
    toward that commitment.
-   **Verification:** A structured assessment of whether the available
    evidence supports the agreed expectations.
-   **Decision:** A human reviewer considers the assessment and
    determines the appropriate next action.

VeriCommit should help answer: **"Does the available evidence support
the claim that this agreed milestone has been met?"**

It should not confuse activity with outcomes. A high number of commits,
pull requests, or hours worked does not, by itself, prove that a
milestone has been achieved.

## 4. The Problem We Want to Solve

Funding software projects involves uncertainty. Grantors may have
limited time, technical expertise, or resources to review every
repository and progress report in depth. Grantees may struggle to
communicate technical progress in a way that is understandable to
non-technical stakeholders.

This can contribute to:

-   Reviews that are slow, inconsistent, or difficult to explain.
-   Decisions based on incomplete reports, superficial activity metrics,
    or assumptions.
-   Unclear expectations about what counts as a completed milestone.
-   Friction when a grantor and grantee interpret progress differently.
-   Reduced confidence in funding programs when promised outcomes and
    reported progress are difficult to reconcile.
-   Discouragement among responsible contributors when expectations,
    feedback, or decisions are unclear.

These are problems to investigate and validate with real grantors and
grantees---not assumptions that every funding relationship experiences
them in the same way.

VeriCommit's role is to make expectations and evidence easier to compare
and review. It cannot guarantee project success, eliminate all disputes,
or prove intent from repository activity alone.

## 5. The Product's Core Thesis

**When commitments are explicit and evidence is evaluated against them
transparently, people can make better-informed decisions with less
ambiguity.**

VeriCommit is built around the following chain:

1.  **Agree:** Define the milestone and its acceptance criteria before
    evaluating the work.
2.  **Evidence:** Gather relevant, accessible project evidence.
3.  **Assess:** Compare the evidence with the agreed criteria and
    identify support, gaps, and uncertainty.
4.  **Explain:** Present findings in language appropriate to technical
    and non-technical readers, with links or references to the evidence
    where available.
5.  **Review:** Let an accountable human consider the report, ask
    questions, and make the final decision.
6.  **Learn:** Over time, use feedback and validated outcomes to improve
    the process without hiding uncertainty or rewriting history.

## 6. Who VeriCommit Serves

### Grantors and funding organizations

They need a practical way to understand progress, compare evidence with
agreed expectations, identify unanswered questions, and make defensible
decisions without having to perform every technical inspection
themselves.

Grantors may include philanthropic organizations, foundations,
companies, ecosystem funds, hackathon organizers, and individuals
funding projects. Their motivations, technical expertise, and review
processes vary.

### Grantees and project teams

They need clear expectations, a fair opportunity to present relevant
evidence, understandable feedback, and visibility into why a milestone
is considered supported, incomplete, or uncertain.

### Reviewers and program administrators

They need consistent information, traceable findings, and a review
process that supports---not replaces---their judgment and
responsibilities.

The product should not assume that only grantees can fail to meet
commitments. Grantors may also make commitments concerning payment
timing, feedback, decisions, or support. Mutual accountability is part
of the long-term vision, even though the initial MVP focuses on
evaluating grantee milestone evidence.

## 7. Guiding Principles

### 7.1 Evidence before assumptions

Assess claims against relevant evidence and the criteria agreed in
advance. Do not treat a confident statement, a large commit count, or an
AI-generated explanation as proof on its own.

### 7.2 Clear expectations before evaluation

A milestone should have an understandable title, description, and
acceptance criteria. Where expectations are ambiguous or change, the
ambiguity or change should be made visible rather than silently judged
against a different standard.

### 7.3 Explain findings and uncertainty

Distinguish between: - **Supported:** Available evidence supports the
criterion. - **Insufficient evidence:** There is not enough relevant
evidence to assess the criterion confidently. - **Uncertain:** Evidence
is ambiguous, conflicting, or otherwise does not support a reliable
conclusion.

Missing evidence is not proof that work was not done. A successful build
or merged change is not automatically proof that the expected outcome
works in practice.

### 7.4 Human accountability for consequential decisions

AI may organize evidence, identify patterns, draft explanations, and
recommend questions for review. It must not independently make final
funding, rejection, repayment, or other consequential decisions in the
MVP.

The responsible human reviewer remains accountable for the decision and
should be able to inspect the supporting evidence.

### 7.5 Fairness to both sides

Make expectations and findings understandable to grantors and grantees.
Do not equate repository volume with quality, punish teams for
irrelevant activity differences, or make unsupported judgments about
someone's character, intent, or trustworthiness.

### 7.6 Mutual accountability over time

The long-term product may support records of commitments and
follow-through by both grantors and grantees---for example, milestone
expectations, review decisions, promised feedback, and payment
timelines. Any such capability must account for context, legitimate
delays, disputes, privacy, and the right to correct inaccurate records.
Accountability should improve clarity, not become a simplistic public
shaming or reputation-scoring system.

### 7.7 Transparency and traceability

Where possible, findings should link back to the evidence and explain
how it relates to a criterion. Preserve the distinction between source
evidence, AI interpretation, and human decision. Corrections and changes
should be visible where appropriate.

### 7.8 Privacy, security, and least privilege

Access only the information needed for the task and respect repository
permissions, confidential project information, and user consent. Do not
expose access tokens, secrets, or private evidence to unauthorized
users. Do not put sensitive project content on a public blockchain.

### 7.9 Accessible communication

Provide concise summaries for non-technical readers while retaining
sufficient detail and evidence references for technical reviewers. Plain
language must simplify the explanation without distorting the technical
meaning.

### 7.10 Practicality before complexity

Solve a validated user problem with the simplest reliable approach.
Avoid adding blockchain, autonomous agents, payment integrations, or
complex infrastructure merely because they are possible.

## 8. The Current MVP

The MVP tests the foundation of VeriCommit's value: **Can we help a
reviewer compare an agreed software milestone with available evidence
and understand the result?**

The intended demonstration flow is:

1.  Define a project milestone and acceptance criteria.
2.  Provide a GitHub repository and an evidence source.
3.  Retrieve relevant GitHub evidence where feasible, with clearly
    labelled sample evidence as a fallback.
4.  Run an AI-assisted evaluation against the agreed criteria.
5.  Produce a report showing criterion-level findings, evidence
    references, gaps, uncertainty, and limitations.
6.  Require a human to review the report and make the final decision.

### MVP boundaries

The MVP does not require:

-   Autonomous funding or rejection decisions.
-   Automatic payments or a complete grant administration platform.
-   A public reputation score for grantors or grantees.
-   A complete system for evaluating every commitment made by both
    parties.
-   A production blockchain integration, including Stellar or Drips.
-   A claim that GitHub activity alone proves a software outcome.
-   Paid APIs or paid services for the hackathon demonstration.

The MVP should remain achievable with free tools and should prioritize a
working end-to-end flow over a large number of features.

## 9. Agentic AI: A Possible Direction

VeriCommit may actively explore **agentic AI**---AI systems that can
carry out multi-step tasks using defined tools and workflows---when
doing so provides a clear, validated benefit.

Potential future agentic capabilities include:

-   Gathering permitted evidence from connected sources.
-   Mapping evidence to individual acceptance criteria.
-   Identifying missing information and preparing clarification
    questions.
-   Producing separate technical and plain-language summaries from the
    same findings.
-   Detecting contradictions or changes that merit human attention.
-   Preparing a review packet and tracking the status of requested
    clarifications.

These are potential directions, not promises that the current MVP
already performs them.

### Agentic AI guardrails

Any agentic workflow should follow these rules:

1.  **Bounded authority:** Agents operate only within explicit task,
    data, and tool permissions.
2.  **Human approval for consequential actions:** Agents must not
    independently approve funding, reject a grantee, initiate payments,
    or publish reputational judgments.
3.  **Evidence traceability:** Material claims should point to the
    source evidence used.
4.  **Visible uncertainty:** Agents must report missing, conflicting, or
    inaccessible evidence instead of inventing answers.
5.  **Untrusted repository content:** Text found in issues, pull
    requests, README files, code comments, or other project artifacts
    must be treated as data, not as instructions that can override the
    agent's rules or permissions.
6.  **Least privilege and privacy:** Use the minimum access needed,
    protect credentials, and respect user authorization.
7.  **Action logs and reversibility:** Record meaningful agent actions
    and provide ways to inspect, correct, or undo reversible changes
    where possible.
8.  **Evaluation before autonomy:** Test reliability, failure handling,
    cost, security, and user benefit before granting an agent additional
    authority.
9.  **No autonomy for its own sake:** Use a deterministic workflow or
    simpler AI assistance when it is sufficient.

The product should be designed so that automation can increase gradually
without removing accountability.

## 10. Long-Term Product Potential

The following are possible expansion areas that must be validated
against user needs and feasibility.

### A. Richer evidence and verification

Support additional evidence sources, test results, releases,
demonstrations, deployment information, and other artifacts appropriate
to each milestone.

### B. Better review and collaboration

Allow reviewers and grantees to ask questions, clarify criteria, submit
additional evidence, record decisions, and maintain a history of
milestone changes.

### C. Mutual commitment records

Record commitments made by both parties, such as milestone expectations,
review deadlines, feedback, payment schedules, and agreed changes. Make
relevant status and history visible to authorized participants.

### D. Program-level insights

Help authorized program administrators understand progress, recurring
bottlenecks, review workload, and patterns across projects without
reducing complex projects to a single misleading score.

### E. Verifiable audit records and blockchain

If there is a validated need for stronger independent verification, a
blockchain such as Stellar could potentially anchor hashes of selected
records or support verifiable approvals. Sensitive project content
should remain off-chain. Blockchain can help establish that a particular
record or approval was recorded; it does not prove that the underlying
software works or that a claim is true.

### F. Authorized milestone-based payments

A future integration might support payments after the relevant human
approval and applicable controls. This would require explicit
authorization, security, dispute handling, and a clear understanding of
who is responsible for the payment.

None of these future possibilities should be treated as part of the MVP
unless the scope is deliberately revised.

## 11. How We Will Judge Progress

### MVP success

-   A user can define a milestone with clear acceptance criteria.
-   The system can obtain live or clearly labelled sample evidence.
-   The evaluation compares evidence with the agreed criteria.
-   The report explains findings, evidence gaps, uncertainty, and
    limitations.
-   A human can review the result and remains responsible for the final
    decision.
-   The complete flow can be demonstrated reliably within the team's
    constraints.

### Product validation

As access to users permits, investigate whether VeriCommit: - Reduces
the time or effort required to prepare and understand a milestone
review. - Makes findings easier for technical and non-technical
stakeholders to understand. - Helps both parties identify unclear
expectations earlier. - Produces findings that reviewers can trace to
relevant evidence. - Is perceived as fair and useful by grantors and
grantees.

These are hypotheses to test, not outcomes to claim before measuring
them.

## 12. Product Decision Filter

Before adding a feature or increasing automation, ask:

1.  What validated user problem does this solve?
2.  Which user benefits, and how?
3.  What evidence would show that the feature works?
4.  Does it make the process clearer and fairer for the relevant
    parties?
5.  What new risks does it introduce for privacy, security, bias, or
    accountability?
6.  Can the same value be achieved with a simpler approach?
7.  Is it necessary for the current MVP, a later validated iteration, or
    only a possible future direction?
8.  If AI or an agent is involved, what tools may it use, what actions
    may it take, and where is human approval required?

## 13. Our North Star

**VeriCommit exists to make commitments easier to understand, evidence
easier to assess, and consequential decisions easier to explain.**

We begin by evaluating grantee milestone evidence against agreed
expectations. We preserve the possibility of broader mutual
accountability as the product evolves, but we will earn that expansion
through user research, reliable implementation, and demonstrated value.

**Fund with Evidence. Keep accountability human. Expand with purpose.**
