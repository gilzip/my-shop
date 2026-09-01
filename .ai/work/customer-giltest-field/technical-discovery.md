# Technical Discovery

## Business Requirement Summary

Add a `GilTest` field to `Customer`, then backfill it to `9999` on every existing customer (currently 5 rows in this project's dev database).

## Existing Capability

Identical mechanism to the `variant-internal-note` feature, now confirmed against `Customer` specifically: `node_modules/@vendure/core/dist/config/custom-field/custom-field-types.d.ts:182` — `Customer?: CustomFieldConfig[];` is a valid `customFields` key.

## Existing Architecture Relevant to This Feature's Domain

The `customFields` mechanism itself is unchanged from what's already documented for `ProductVariant.internalNote`. The one genuinely new piece for this feature is the **backfill of existing rows** - none of the prior three customField/config-only features needed to touch data already in the database; they only affected rows created/edited after the change. This project currently has exactly 5 `customer` rows to backfill.

## Similar Implementations

`variant-internal-note`'s `technical-discovery.md`/`architecture.md`/`schema-execution.md` is the direct precedent for the customField-and-migration mechanics. The backfill itself has no precedent in this project yet - it's a plain `UPDATE customer SET customFieldsGiltest = 9999` (or equivalent), not something Vendure has a dedicated mechanism for beyond the migration file itself optionally containing that data change.

## Existing Business Rules Encoded in the System

None specific to this feature - this is a test field with no business meaning, per the requirement itself.

## Relevant Tests

None exist in this project (same pre-existing gap as all prior features).

## Reuse Opportunities

Full reuse of the `customFields` mechanism and the `npx vendure migrate` workflow already established by `variant-internal-note`.

## Required Changes

1. Add `customFields.Customer` entry (`GilTest`) to `vendure-config.ts`.
2. Generate the migration (creates the column).
3. **New**: include a data-backfill step - either as part of the generated migration's `up()` (a plain `UPDATE` statement can be added alongside the schema change) or as a separate one-off script/query run after the migration applies. This choice is the Architect stage's to make.

## New Business Behavior

None - this is a schema/data change with no business logic attached.

## Relevant Files

- `src/vendure-config.ts`.
- A new migration file under `src/migrations/`.

## Evidence from Source

- `node_modules/@vendure/core/dist/config/custom-field/custom-field-types.d.ts:182`.
- Direct query against `vendure.sqlite`: `customer` table currently has 5 rows, columns `createdAt, updatedAt, deletedAt, title, firstName, lastName, phoneNumber, emailAddress, id, userId`.

## Open Questions

Field type: the business requirement gives a value of `9999` but no other constraint. Given the requirement explicitly says this field has no ongoing business meaning, the Architect should just pick the simplest reasonable type (e.g. `int`) rather than treating this as a meaningful design decision.
