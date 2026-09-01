# Technical Discovery

## Business Requirement Summary

Add `gil_payment` to `Payment`, backfill all 4 existing rows to `99999`, and have every new Payment default to `99999` automatically — without touching payment processing logic.

## Existing Capability

`Payment?: CustomFieldConfig[]` confirmed as a valid `customFields` key (`custom-field-types.d.ts:191`), same mechanism as the three prior customField features.

## Existing Architecture Relevant to This Feature's Domain

**The one genuinely new technical question this feature raises, that none of the prior three needed to answer: does a customField's `defaultValue` actually apply to new rows at runtime, or is it purely a UI/form default?**

Traced into `register-custom-entity-fields.js`, the function that turns a customField config into a real TypeORM column definition:

```js
function getDefault(customField, dbEngine) {
    const { name, type, list, defaultValue, nullable } = customField;
    if (list && defaultValue) { ... }
    return type === 'datetime' ? formatDefaultDatetime(dbEngine, defaultValue) : defaultValue;
}
```

This return value feeds directly into the generated column's `default` option — i.e. `defaultValue` becomes a **real database-level column DEFAULT**, not merely a value the Dashboard's form pre-fills. This means: **any INSERT into `payment` that doesn't explicitly set this column - from real payment processing code, from an admin tool, from anywhere - gets `99999` automatically, enforced by the database itself.** No application code needs to be touched to satisfy "new payments default to 99999," and this is structurally incapable of interfering with payment processing logic, since payment processing never needs to know this column exists.

## Similar Implementations

Identical customField+migration mechanics to `customer-giltest-field`. The backfill-in-migration pattern established there applies here unchanged.

## Existing Business Rules Encoded in the System

None specific to this field. Confirmed this project currently has exactly 4 `payment` rows (all from this session's live checkout testing), none real production data.

## Relevant Tests

None exist (same pre-existing gap as all prior features).

## Reuse Opportunities

Full reuse of the customFields mechanism and the migration-with-backfill pattern from `customer-giltest-field`. The `defaultValue` mechanism itself is also full reuse - it's a standard customField option already available, not something built for this feature.

## Required Changes

1. Add `customFields.Payment` entry (`gil_payment`, `defaultValue: 99999`) to `vendure-config.ts`.
2. Generate the migration; add one `UPDATE` statement to backfill the 4 existing rows to `99999` (existing rows predate the column existing, so the DB-level default doesn't retroactively apply to them - it only governs *new* inserts after the column exists).

## New Business Behavior

None - purely additive, inert data.

## Relevant Files

- `src/vendure-config.ts`.
- A new migration file under `src/migrations/`.

## Evidence from Source

- `node_modules/@vendure/core/dist/config/custom-field/custom-field-types.d.ts:191` - `Payment?: CustomFieldConfig[]`.
- `node_modules/@vendure/core/dist/entity/register-custom-entity-fields.js` (`getDefault()`) - confirms `defaultValue` becomes a real DB column default.
- Direct query against `vendure.sqlite`: `payment` table currently has 4 rows.

## Open Questions

None blocking. One thing made explicit rather than assumed: the backfill migration is still necessary even though `defaultValue` is set, because a column-level default only governs rows inserted *after* the column exists - the 4 pre-existing rows need an explicit `UPDATE`, exactly as `customer-giltest-field` did.
