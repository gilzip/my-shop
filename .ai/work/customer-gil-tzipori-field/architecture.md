# Architecture: Customer.internalNote

## Verified Architecture

Independently confirmed against real source (not just taken from `technical-discovery.md`):

- `src/vendure-config.ts` (read directly, lines 78–106): `customFields` config already has a `Customer` array containing one field, `GilTest` (`type: 'int'`, `nullable: true`, **no `public` key** → defaults to `true`/exposed to Shop API per Vendure's own type comment). `ProductVariant` array has exactly one field, `internalNote` (`type: 'text'`, `nullable: true`, `public: false`, with `label`/`description` metadata) — this is the correct functional template for the new field.
- `src/migrations/1787549554034-AddCustomerGilTest.ts` (read directly): confirms Vendure's SQLite migration pattern for adding a customField to `Customer` — since `better-sqlite3` doesn't support `ALTER TABLE ADD COLUMN` the way TypeORM's generator prefers here, it rebuilds the table (`temporary_customer` → drop → rename) and preserves existing FK/unique constraints (`userId` FK to `user`). The new column appears as `customFieldsGiltest` (config name `GilTest`, lowercased by TypeORM's naming strategy).
- `src/migrations/1787489491389-AddProductVariantInternalNote.ts` (read directly): same rebuild pattern for `ProductVariant`, adding `customFieldsInternalnote text` and correctly re-creating the three indexes that existed on that table before rebuilding it. Confirms the "rebuild + re-create indexes/constraints" pattern is what a correct migration for this repo looks like — the `Customer` table has one FK+unique constraint (`userId`) that must likewise be preserved by any new migration touching it.
- `.ai/schema-overview.md` (read directly): confirms `Customer.GilTest`'s migration exists but was **never added to this living document's "Custom additions" table** — a pre-existing documentation gap in this repo, not something this feature needs to fix, but noted so the DBA stage doesn't mistake its absence for the field not existing.
- `.ai/api-overview.md` (read directly): confirms Vendure's Shop/Admin API split is driven by the `public` customField flag with no other gating mechanism, and that `updateCustomer` exists on **both** Admin and Shop APIs (different principals) — meaning `public: false` must correctly exclude `internalNote` from the Shop API's `updateCustomer` input/output as well as from `customer`/`customers` on Admin's side being the only place it appears. No separate guard is needed beyond the `public` flag itself, per Vendure's `addGraphQLCustomFields(..., publicOnly)` split already found in discovery.

## Proposed Design

Add one customField entry to the existing `Customer` array in `src/vendure-config.ts`, following the exact shape of `ProductVariant.internalNote`:

```ts
Customer: [
    {
        name: 'GilTest',
        type: 'int',
        nullable: true,
        label: [{ languageCode: LanguageCode.en, value: 'GilTest (pipeline test field)' }],
        description: [{
            languageCode: LanguageCode.en,
            value: 'Internal pipeline test field - no business meaning.',
        }],
    },
    {
        name: 'internalNote',
        type: 'text',
        nullable: true,
        public: false,
        label: [{ languageCode: LanguageCode.en, value: 'Internal note' }],
        description: [{
            languageCode: LanguageCode.en,
            value: 'Internal-only note for back-office staff. Never shown to customers.',
        }],
    },
],
```

No new plugin, service, resolver, or mutation is needed — Vendure's existing `updateCustomer` Admin API mutation and the auto-generated Admin UI/Dashboard customFields form already read/write any field added to this array. This mirrors exactly how `ProductVariant.internalNote` is exposed today with zero bespoke code.

## Files to Create/Modify

- **Modify** `src/vendure-config.ts` — add the `internalNote` entry to `customFields.Customer` (as above).
- **Create** `src/migrations/<timestamp>-AddCustomerInternalNote.ts` — generated via Vendure's migration tooling, following the rebuild pattern seen in the two existing Customer/ProductVariant migrations. Must preserve the `customer` table's existing `userId` FK + unique constraint, exactly as `AddCustomerGilTest` already does, and must not touch the existing (buggy) `customFieldsGiltest` column — this feature only adds a new column alongside it.

## Registration/Configuration Needed

None beyond the two changes above. `type: 'text'` (not `'string'`) is intentional and matches `ProductVariant.internalNote`'s choice — Vendure's `'text'` customField type maps to an unbounded text column (vs. `'string'`'s length-capped `varchar`), appropriate for a free-text note with no stated length limit.

## Frontend/Storefront Implications

None. Since `public: false` excludes this field from the Shop API entirely (confirmed via `addGraphQLCustomFields(..., publicOnly=true)` for Shop API schema generation), no storefront code can reference it, and none should be written to. It will appear automatically in the Admin Dashboard's customFields UI for Customer, same as `internalNote` already does for ProductVariant — no custom Dashboard UI work is required.

## Tests to Add

None. This repository has zero test infrastructure (`technical-discovery.md` confirms no `.spec.ts`/`.test.ts` files exist anywhere), and the prior identical `variant-internal-note` feature set no precedent for adding one. Introducing a test framework is out of scope for this feature — consistent with the existing pattern, not a gap unique to this change.

## Risks

- **Migration correctness on SQLite table rebuild**: the rebuild-and-rename pattern is mechanical but must exactly preserve the existing `userId` FK and unique constraint, or a rollback (`down`) could leave the schema inconsistent. Mitigate by generating the migration via Vendure's own tooling rather than hand-writing it, same as both existing migrations were produced.
- **Pre-existing `Customer.GilTest` exposure bug**: unrelated to this change, not fixed here (per DBA-stage scope boundary), already flagged to the stakeholder separately. Calling it out again here so the DBA stage doesn't conflate the two `Customer` customFields or assume `GilTest`'s missing `public: false` is this feature's mistake.
- **`.ai/schema-overview.md` gap**: that document never recorded `GilTest`'s migration. The DBA stage should add both the historical `GilTest` entry (if in scope) and the new `internalNote` entry when it updates this file, so the living doc doesn't develop a second undocumented field.

## Rejected Alternatives

- **A dedicated `CustomerNote` entity/table**: rejected — massive overkill for a single current-value, no-history free-text field; Vendure's `customFields` mechanism already covers this exactly, and inventing a parallel entity would contradict the "smallest extension that follows existing patterns" principle and this repo's own established precedent (`ProductVariant.internalNote`).
- **A new plugin to own this field**: rejected — no plugin exists in this repo for good reason (nothing here needs plugin-level lifecycle hooks, event subscribers, or new services), and both existing customFields were added as bare config entries, not via a plugin. Adding one here would be a new architectural pattern for no functional benefit.
- **Naming the field `gil_tzipori` / `GilTzipori` literally**: rejected per the stakeholder-approved naming decision carried in `epic.md` — this repo's customFields are named for function, in camelCase, and `GilTest`'s person-adjacent name is documented as a throwaway test artifact, not a convention to extend.
