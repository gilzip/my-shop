---
name: vendure-feature-orchestrator
description: Run the full feature-development pipeline end-to-end for the Vendure-based commerce platform - Business PM, then Technical PM, then Software Architect, then Developer, then DBA, then Reviewer - from one raw business need through to a reviewed implementation. Use by default whenever the user brings a new feature/business need for this platform and wants it carried through the whole process, e.g. "we want customers to pay with Apple Pay, take it all the way through", "run the full pipeline on this feature request", "process this business request end to end". Owns the sequencing, decides when to pause for the user and when to continue automatically, and routes a Reviewer FAIL back to the Developer. Do NOT use for a single point-in-time step on a feature already partway through the pipeline (e.g. "just redo the architecture doc") - call that individual skill directly instead.
---

# Vendure Feature Orchestrator

You are running the full agentic development pipeline for a feature on the Vendure-based commerce platform, end to end:

```
Business Product Manager -> business-requirement.md
Technical Product Manager -> technical-discovery.md, epic.md, stories.md
Software Architect        -> architecture.md
Developer                 -> code + tests + implementation.md
DBA                        -> schema-execution.md
Reviewer                  -> review.md (PASS / FAIL)
```

You are the only thing responsible for sequencing this. Each stage skill defines its own hard boundaries (what it may and may not inspect or decide) - your job is to invoke each stage with the right inputs, in the right order, and to decide when human judgment needs to enter the loop versus when it's safe to keep going on your own.

## Why this is a separate skill from the six stages

Every stage skill (business-product-manager, technical-product-manager, software-architect, developer, dba, reviewer) is deliberately scoped to do one job and not overstep into the next one's territory - that separation is what keeps each stage trustworthy. This skill doesn't replace any of that; it just holds the thread connecting them, so the user can ask for a feature once instead of manually invoking five skills in the right order and manually copying artifacts between them.

## Setup

1. Derive a short kebab-case `{feature}` slug from the business request (e.g. `apple-pay-checkout`, `demo-wallet`). Use this exact slug for every artifact path in every stage - this is what lets the stages hand off work to each other.
2. All artifacts for this feature live under `.ai/work/{feature}/`.

## Stage sequence

Run the stages below in order. Before running a stage, confirm its expected inputs already exist; if they don't, that's a sign a prior stage was skipped, not a reason to invent missing input yourself.

### 1. Business Product Manager

Input: the raw business request.
Output: `.ai/work/{feature}/business-requirement.md`.

**Pause point:** once this is written, show it to the user before continuing. This is the cheapest possible point to catch a misunderstanding of what's being asked - continuing past it wastes real work (code discovery, architecture) if the business framing is wrong. Proceed automatically only if the user has already said up front that they want the whole pipeline run without stopping for review at each stage.

### 2. Technical Product Manager

Input: `.ai/work/{feature}/business-requirement.md` plus the real repository.
Output: `.ai/work/{feature}/technical-discovery.md`, `.ai/work/{feature}/epic.md`, `.ai/work/{feature}/stories.md`.

This stage does real repository investigation (discovery), which is more expensive than the business stage - worth pausing for if the business stage revealed the request was ambiguous, but otherwise safe to continue into automatically once the business requirement is confirmed.

### 3. Software Architect

Input: the business requirement plus the Epic and Stories, verified against the real source.
Output: `.ai/work/{feature}/architecture.md`.

**Pause point:** this is the last stage before any code is touched. Show the architecture document to the user here even in an otherwise automatic run - once the Developer stage starts, changes get more expensive to unwind, so this is the natural last checkpoint before that.

### 4. Developer

Input: business requirement, discovery, Epic/Stories, and the architecture document.
Output: actual code changes, tests, and `.ai/work/{feature}/implementation.md`.

### 5. DBA

Input: `technical-discovery.md`/`stories.md` (the Technical PM's spec of what the feature needs to persist), `architecture.md` (the Architect's data-model guidance), and the Developer's `implementation.md` plus the real code/migration it produced.
Output: `.ai/work/{feature}/schema-execution.md`.

The DBA verifies what the Developer actually built against the Technical PM's spec and the Architect's guidance, corrects the schema where it diverges, and executes (authors/runs) the final migration. Only run this stage if the feature actually needs a schema change (new/modified tables, fields, or indexes). If nothing in the spec or architecture called for one, skip straight to the Reviewer.

### 6. Reviewer

Input: the full trail (business requirement, discovery, Epic/Stories, architecture, implementation summary, `schema-execution.md` if produced, the real `git diff`, and test results).
Output: `.ai/work/{feature}/review.md`, ending in a `PASS` or `FAIL` verdict.

## Handling the Reviewer's verdict

- **PASS:** the pipeline is done. Report to the user what was built and point them at the artifacts and the diff.
- **FAIL:** route the Reviewer's findings back to the Developer stage and have it address them, then run the Reviewer again. Cap this at 2 review/fix cycles - if it's still failing after that, stop and hand the situation to the user with the latest `review.md` rather than looping indefinitely. An unresolved disagreement after two rounds is a sign something upstream (architecture, or even the requirement) may need revisiting, not just another coding pass.

## What "done" looks like

Tell the user, in plain terms: what the feature does now, where each artifact lives under `.ai/work/{feature}/`, what the `git diff` touches, and the Reviewer's final verdict. Don't just say "pipeline complete" - the user should be able to tell at a glance whether this is ready to merge or still needs their attention.
