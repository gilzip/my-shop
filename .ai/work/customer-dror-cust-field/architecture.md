# Architecture: Customer dror_cust Field

## Verified Architecture

Re-confirmed by direct read of `src/vendure-config.ts` immediately before writing this document: `Customer` currently has exactly two customFields (`GilTest`, `internalNote`), matching what discovery reported.

## Proposed Design

Append a third entry to the existing `customFields.Customer` array:
```ts
Customer: [
    { name: 'GilTest', ... },        // unchanged
    { name: 'internalNote', ... },   // unchanged
    {
        name: 'dror_cust',
        type: 'text',
        nullable: true,
        label: [{ languageCode: LanguageCode.en, value: 'dror_cust (pipeline test field)' }],
        description: [{ languageCode: LanguageCode.en, value: 'Internal pipeline test field - no default, no backfill.' }],
    },
],
```
No `defaultValue` — the migration will add the column only; existing rows get `NULL` by default (SQLite's normal behavior for a new nullable column with no explicit default), which is exactly "no backfill."

## Files to Create/Modify

- **Modify**: `src/vendure-config.ts` — append to the existing `Customer` array, touching nothing else.
- **Create**: one migration under `src/migrations/`.

## Tests to Add

1. Confirm the column exists and all existing customer rows show `NULL` (Story 2).
2. Confirm `GilTest`/`internalNote` values are unchanged for existing customers (Story 3).

## Risks

Negligible - simplest field-addition variant in this series (no default, no backfill logic to get wrong).

## Rejected Alternatives

None applicable - this is the minimal-complexity case.
