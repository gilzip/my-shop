# Schema Execution: Internal Note on Product Variant

## Developer's Work vs. Spec/Architecture

Compared what the Developer actually built against `technical-discovery.md`/`stories.md` (Technical PM spec) and `architecture.md` (Architect guidance):

| Called for | What was built | Match? |
|---|---|---|
| Optional free-text field, multi-sentence capacity, on `ProductVariant` | `customFields.ProductVariant.internalNote`, `type: 'text'`, `nullable: true` | ✓ |
| Admin-only, never in Shop API | `public: false` | ✓ — verified live: `ProductVariantCustomFields` type doesn't exist at all in the Shop API schema |
| No new entity/table | Config-only change, no entity/plugin added | ✓ |
| Captured as a real, committed migration (project runs `synchronize: false`) | Generated via `npx vendure migrate --generate`, not hand-written | ✓ |
| Migration actually applied | Confirmed via direct DB inspection: column present, migration recorded | ✓ |

**No corrections needed.** The Developer's implementation matches the spec and architecture exactly - re-verified independently below rather than taken on `implementation.md`'s word.

## CustomFields vs. Dedicated Table/Column

**Decision: CustomFields (`customFields.ProductVariant.internalNote`) - confirmed correct.**

Reasoning, re-checked independently: this is a single optional attribute of an existing entity with no relations, no independent lifecycle, and no need for its own history/audit (explicitly out of scope per the Stories). A dedicated table would only be justified if notes needed multiplicity (many notes per variant), their own timestamps/authorship, or a lifecycle distinct from the variant itself - none of which apply here. CustomFields is the right call, not just the convenient one.

## Independent Verification of the Executed Schema

Re-inspected the live database directly (not just re-reading `implementation.md`'s claims):

```
PRAGMA table_info(product_variant) →
  ... existing columns unchanged ...
  (12, 'customFieldsInternalnote', 'TEXT', 0, None, 0)   -- nullable, no default, correct

SELECT * FROM migrations →
  (1, 1787489491389, 'AddProductVariantInternalNote1787489491389')  -- recorded as applied
```

No other column, index, or table was touched. The `up()`/`down()` migration (SQLite's standard TypeORM table-rebuild pattern, since SQLite can't `ALTER TABLE ADD COLUMN` inside existing FK constraints the way other engines can) only adds/removes this one column - confirmed by reading the migration file directly, not assumed from its filename.

## Final Schema

| Table | Column | Type | Nullable | Default | Index |
|---|---|---|---|---|---|
| `product_variant` | `customFieldsInternalnote` | `TEXT` | yes | none | none |

No relations introduced. No new tables.

## Migration Executed

- **File**: `src/migrations/1787489491389-AddProductVariantInternalNote.ts`
- **Shape**: SQLite table-rebuild pattern - `up()` recreates `product_variant` with the new nullable `customFieldsInternalnote TEXT` column and re-inserts existing rows unchanged (all pre-existing variants get `NULL`, which is the correct "no note yet" state, not a migration hazard); `down()` reverses it cleanly, dropping the column via the same rebuild pattern.
- **Applied**: yes - confirmed directly against `vendure.sqlite` (see verification above), not just because the CLI reported success.

## Indexes

**None added, and none needed.** An internal free-text note has no query pattern that would benefit from an index (it's not filtered or sorted on) - adding one here would be exactly the kind of speculative index this stage is supposed to reject.

## Risks

- **First migration in this project's history**: now that `src/migrations/` exists with one committed pattern, future customField changes have a real precedent to follow rather than starting from an empty directory each time - this reduces risk for *future* changes rather than introducing new risk now.
- **Existing rows**: all pre-existing `product_variant` rows now have `customFieldsInternalnote = NULL`, which is the correct default "no note" state - no backfill needed, no data loss risk.
- **No locking concern**: this is a small SQLite dev database; the table-rebuild happens on a table with only a handful of rows in this environment. On a large production dataset with the same pattern, this table-rebuild approach (not a simple `ADD COLUMN`) would hold a stronger lock for longer - worth flagging for whoever eventually runs this against a production-scale Postgres/MySQL database, though the *generated* SQL will differ by engine since TypeORM's rebuild-table pattern is SQLite-specific.

## Verdict

Schema execution matches the approved architecture with no corrections needed. Proceeding to update the living schema document.
