# Epic: Internal Note on Product Variant

## Summary

Give admin/back-office staff a place to record a free-text internal note on any product variant, using Vendure's built-in CustomFields mechanism configured as admin-only (`public: false`). No new entity, table, or UI code is required — this epic is scoped entirely to configuration plus the resulting database migration.

## Why now

This is deliberately the first feature run through the team's new development pipeline (Business PM → Technical PM → Software Architect → Developer → DBA → Reviewer), chosen specifically because it's small and low-risk enough to validate the process end to end while still exercising a real schema change.

## What "done" looks like in the context of this product

- `ProductVariant.customFields.internalNote` exists, is nullable, and is editable/visible in the Vendure Dashboard's existing variant detail page — with zero Dashboard code changes, since the Dashboard already renders custom fields generically for `ProductVariant`.
- The field is completely absent from the Shop API schema (verified by Vendure's own `publicOnly` schema-generation behavior for `public: false` fields — not just permission-checked, structurally absent).
- The change is captured in a committed TypeORM migration, since this project runs `synchronize: false`.

## In Scope

- One `customFields.ProductVariant` entry: `internalNote` (multi-line text, nullable, admin-only).
- The migration that applies it to the SQLite database.

## Out of Scope

- Any UI beyond what the Dashboard already renders automatically.
- Notes at any level other than ProductVariant.
- Edit history / audit trail of the note.
- Any Shop API or storefront exposure, in any form.

## Dependencies

None on other in-flight work. This is the first customField and first migration in the project's history, so it also establishes the pattern (and the `src/migrations/` directory) for future ones.
