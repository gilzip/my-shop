# Technical Discovery

## Business Requirement Summary

Add `dror_cust` to `Customer` — nullable text, no default, no backfill. The plainest variant of the customField pattern used three times already in this project.

## Existing Capability

`Customer?: CustomFieldConfig[]` already confirmed valid in prior features. `Customer` currently has two customFields (`GilTest`, `internalNote`) — re-confirmed directly by reading the live `vendure-config.ts` before writing this document, since external changes have appeared in this file before without going through this pipeline.

## Existing Architecture Relevant to This Feature's Domain

None new — this is the same mechanism as `customer-giltest-field`, minus the backfill (no `defaultValue` set, so no column-level default and no migration `UPDATE` needed — existing rows simply get `NULL`, which is exactly what "no backfill" means at the database level).

## Required Changes

1. Add a third entry to the existing `customFields.Customer` array in `vendure-config.ts` — `dror_cust`, `type: 'text'`, `nullable: true`, no `defaultValue`.
2. Generate the migration (adds the column only — no `UPDATE` statement, since there's nothing to backfill).

## Relevant Files

- `src/vendure-config.ts` — append to the existing `Customer` array without disturbing the two existing entries.
- A new migration file under `src/migrations/`.

## Evidence from Source

- Direct read of `src/vendure-config.ts:94-116` (current `Customer` customFields block).
- `node_modules/@vendure/core/dist/config/custom-field/custom-field-types.d.ts` — `Customer` key (established in prior features).

## Open Questions

None.
