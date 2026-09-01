# Schema Execution

## What the Developer Built vs. What Was Specified

`technical-discovery.md` and `stories.md` called for a single internal-only, staff-editable free-text note on `Customer`, with no history/audit. `architecture.md` specified this as one `customFields.Customer` entry (`internalNote`, `type: 'text'`, `nullable: true`, `public: false`), generated via Vendure's own migration tooling, without touching the pre-existing (and separately-tracked) `GilTest` field.

The Developer's implementation matches this exactly:
- `src/vendure-config.ts` — `internalNote` added to `customFields.Customer` with the specified type, nullability, and `public: false`.
- `src/migrations/1787641335045-AddCustomerInternalNote.ts` — generated (not hand-written), adds only `customFieldsInternalnote TEXT` to the `customer` table, preserves the existing `userId` FK/unique constraint, and does not touch `customFieldsGiltest`.

No corrections were needed — the Developer's schema change matches spec and architecture with no divergence.

## Independent Re-Verification (this stage)

Re-ran the following independently, rather than trusting `implementation.md`'s account alone:
1. `npx vendure migrate --run` → `No pending migrations found` — confirms the migration is already applied and the DB is current.
2. `npx vendure migrate --generate` (drift check) → `No changes in database schema were found, so no migration was generated` — confirms `vendure-config.ts` and the live `vendure.sqlite` schema are fully in sync, with no missing or stray migration.
3. Inspected `vendure-config.ts`'s `customFields.Customer` array directly — confirms `GilTest` is untouched and `internalNote` matches architecture.md's spec exactly.

## Final Schema

| Table | Column | Type | Nullable | Default | Public (Shop API) |
|---|---|---|---|---|---|
| `customer` | `customFieldsInternalnote` (config name `internalNote`) | `TEXT` | yes | none | no |

No new table, no new relation. No index added — the only access pattern this feature introduces is reading/writing the note as part of loading/updating a single customer record by id (already covered by the existing primary-key lookup), not filtering or searching by note content. Speculatively indexing an unindexed free-text field with no query pattern calling for it would be waste, not correctness.

## CustomFields vs. Dedicated Table

Vendure's `customFields` mechanism (confirmed correct by architecture.md and re-confirmed here) — this is a single current-value, no-history scalar field with no independent lifecycle, relations, or query pattern that would justify a dedicated table. Using a dedicated table would be over-engineering relative to `ProductVariant.internalNote`'s existing precedent in this same codebase.

## Migration Executed

- File: `src/migrations/1787641335045-AddCustomerInternalNote.ts`
- Up: rebuilds `customer` (SQLite ADD COLUMN limitation) to add nullable `customFieldsInternalnote TEXT`, preserving `userId` FK + unique constraint and the existing `customFieldsGiltest` column unchanged.
- Down: reverses the rebuild, dropping the column.
- Confirmed applied cleanly against the dev `vendure.sqlite`, and confirmed (via drift check) to be the complete, correct migration for the current config — nothing missing, nothing stray.

## Risks

- **Backfill**: none needed — the field is nullable with no default, and existing customers correctly read as `null` until a staff member sets a value (this was an explicit edge case in `stories.md` and requires no migration-time data change, unlike `GilTest`'s int backfill-to-9999).
- **Locking**: negligible — SQLite table rebuild on a `customer` table takes an exclusive lock only for the duration of the migration; acceptable for a dev/low-volume context and consistent with how the two prior migrations on this project already operate.
- **Backward compatibility**: none broken — additive nullable column only; no existing query, mutation, or code path is changed.

## Note: Pre-Existing `Customer.GilTest` Exposure

Confirmed again during this stage (via the live Admin/Shop API introspection already run in `implementation.md`) that `Customer.GilTest` lacks `public: false` and is exposed to the Shop API. This is **not** part of this feature's scope per the DBA stage's own boundary (existing unrelated schema issues are noted, not fixed here) — it is already being addressed as a separate, independently tracked task. `.ai/schema-overview.md` has been updated to record `GilTest`'s column (a pre-existing documentation gap, now closed) alongside the new `internalNote` field, so the living schema doc no longer has an undocumented column.
