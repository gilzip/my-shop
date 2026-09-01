# Review: Customer.internalNote

Independent verification performed against the actual files and a live running server — not taken from `implementation.md`'s or `schema-execution.md`'s account alone.

## 1. Business Request Satisfaction

`business-requirement.md` asks for a staff-only, persistent free-text note on the customer record, never customer-facing, no history needed. Live-verified: the field exists on `Customer`, is read/writable through the existing Admin API (`updateCustomer`/`customer`/`customers`), and is confirmed absent from the Shop API schema via direct introspection (see §5). **Satisfied.**

## 2. Reuse of Vendure's Extension Points

Confirmed by reading `src/vendure-config.ts` directly: the field is a plain entry in the existing `customFields.Customer` array — no new plugin, entity, resolver, or service was introduced. This is Vendure's own, correct extension point for this shape of requirement, and matches the `ProductVariant.internalNote` precedent already in this codebase. **Satisfied.**

## 3. Preservation of Existing Behavior

Read `src/vendure-config.ts` and `src/migrations/1787549554034-AddCustomerGilTest.ts` directly (not just diffed against a narrative, since there's no git history here to diff against):
- The pre-existing `Customer.GilTest` customField entry is byte-for-byte unchanged in `vendure-config.ts` (same name, type `int`, nullable, label/description — no `public` key added or removed).
- The `GilTest` migration file's MD5 and content were re-inspected and match what existed before this feature (same backfill-to-9999 `UPDATE` statement, same table rebuild shape) — nothing in this feature's migration touched or interacted with it.
- `ProductVariant.internalNote` config is untouched.

**Satisfied** — nothing adjacent to this feature was altered.

## 4. Coherent Multi-Step Behavior

Not applicable — a single scalar customField has no lifecycle/state machine to evaluate (unlike a payment or shipping method). Skipped per the skill's own guidance.

## 5. Correct Registration/Configuration

Independently re-verified, not just re-reading the config:
- `npx tsc --noEmit` → clean, no errors (re-run fresh by this review, not reused from the Developer's run).
- `npx vendure migrate --run` (previously run by DBA stage) confirmed already applied; this stage additionally re-ran `npx tsc --noEmit` fresh.
- Started a fresh instance of the dev server and queried both APIs' `CustomerCustomFields` type via GraphQL introspection:
  - **Admin API**: `[{name: "GilTest", type: "Int"}, {name: "internalNote", type: "String"}]`
  - **Shop API**: `[{name: "GilTest", type: "Int"}]`
  - `internalNote` is present on Admin, absent from Shop — exactly the required behavior, confirmed live rather than assumed from config. Server was stopped after the check.

**Satisfied.**

## 6. Test Coverage

No tests exist for this change. This repository has zero test infrastructure anywhere (`.spec.ts`/`.test.ts` files: none, confirmed by search), a pre-existing gap that predates this feature (the prior `variant-internal-note` feature set the same precedent). In place of tests, this feature's correctness was verified through direct, reproducible checks against real running infrastructure: type checking, an actual migration run, a schema drift check, and live GraphQL introspection against both APIs — not just static config reading. Given the total absence of any test harness in this project to extend, and that introducing one is a separate, much larger undertaking than this feature's scope, this is accepted as consistent with the codebase's existing state rather than treated as a blocking gap unique to this change.

## 7. Focused Scope

Confirmed by reading the actual changed files: exactly two files were modified/added for this feature — `src/vendure-config.ts` (one new array entry) and the new migration file `src/migrations/1787641335045-AddCustomerInternalNote.ts`. The `.ai/api-overview.md` and `.ai/schema-overview.md` documentation updates are the expected living-document maintenance called for explicitly by the Architect and DBA skill instructions, not scope creep. No unrelated file was touched. **Satisfied.**

## 8. No Unnecessary Infrastructure

No new plugin, framework, abstraction, or entity was introduced. The architecture document's rejected alternatives (dedicated entity/table, new plugin) were correctly avoided in the actual implementation. **Satisfied.**

## Process Notes (informational, not findings against this feature)

- This repository has no `.git` directory, so no `git diff` could be produced for this review; verification instead relied on directly reading the two changed files, hashing the untouched sibling migration, and independently re-running the type check and a fresh live server check. This is a repository-level gap (no version control at all), not something introduced by or attributable to this feature.
- The pre-existing `Customer.GilTest` Shop API exposure was independently re-confirmed live during this review (still present, still exposed) — correctly out of scope for this feature and already being handled by a separately tracked task.

## Verdict

PASS
