# Architecture: Customer GilTest Field

## Verified Architecture

Re-confirmed `Customer?: CustomFieldConfig[]` in the installed `@vendure/core`'s `CustomFields` type (same file/mechanism as `variant-internal-note`, just a different entity key). Re-confirmed via direct query that this project's dev database currently has exactly 5 `customer` rows, deletedAt not currently set on any of them.

## Proposed Design

1. **`vendure-config.ts`**: add
   ```ts
   customFields: {
       ProductVariant: [ /* existing internalNote entry, unchanged */ ],
       Customer: [
           {
               name: 'GilTest',
               type: 'int',
               nullable: true,
               label: [{ languageCode: LanguageCode.en, value: 'GilTest (pipeline test field)' }],
               description: [{ languageCode: LanguageCode.en, value: 'Internal pipeline test field - no business meaning.' }],
           },
       ],
   },
   ```
   No `public: false` is specified deliberately - the business requirement doesn't ask for this to be hidden from any surface, unlike `internalNote`; leaving it at the framework default (`public: true`) is the smallest choice that doesn't add an unrequested restriction.

2. **Migration + backfill**: generate the migration via `npx vendure migrate --generate`, then add one additional statement to the generated `up()` (a plain `UPDATE "customer" SET "customFieldsGiltest" = 9999`), so the schema change and the data backfill happen together, atomically, in the same migration - rather than as a separate ad-hoc script. This directly satisfies Story 2 ("every existing customer... with no exceptions") without excluding soft-deleted rows, since a plain `UPDATE` with no `WHERE` clause naturally covers all rows including those with `deletedAt` set - matching the business requirement's unqualified "every existing customer."

   The migration's `down()` should not attempt to "un-backfill" the value (there's nothing meaningful to restore it to) - dropping the column in `down()` is sufficient, consistent with how `variant-internal-note`'s migration handled its own reversal.

## Files to Create/Modify

- **Modify**: `src/vendure-config.ts` - add the `Customer` key to the existing `customFields` object (alongside the untouched `ProductVariant` entry).
- **Create**: one migration file under `src/migrations/`, generated then given one added `UPDATE` statement for the backfill.

## Registration/Configuration Needed

None beyond the config change - same as `variant-internal-note`.

## Frontend/Storefront Implications

None - no storefront in this repo, and this field carries no business meaning to expose either way.

## Tests to Add

Same manual-but-real approach as prior features:
1. Confirm the column exists and all 5 existing rows show `9999` via direct DB query.
2. Confirm `Customer.customFields.GilTest` is queryable via the Admin API on an existing customer.

## Risks

Negligible - this is the simplest change of any feature run through this pipeline so far. The only thing worth naming explicitly: bundling the backfill into the migration's `up()` means this migration is not purely a schema change (unlike every prior migration in this project) - worth the DBA stage confirming this is an acceptable pattern for this project rather than assuming it silently, since future engineers reading `src/migrations/` might expect migrations there to be schema-only.

## Rejected Alternatives

- **A separate one-off script for the backfill, run manually after the migration.** Rejected: splits one logical change ("add + backfill") into two steps that could be run out of order or one forgotten, when a single migration can express both atomically and be captured in the same commit/history entry.
- **`public: false`.** Rejected - not requested, and adding an unrequested restriction isn't the smallest reasonable change.
