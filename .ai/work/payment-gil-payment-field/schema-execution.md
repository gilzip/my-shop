# Schema Execution: Payment gil_payment Field

## Developer's Work vs. Spec/Architecture

| Called for | What was built | Match? |
|---|---|---|
| `gil_payment` int field on Payment, `defaultValue: 99999` | `customFields.Payment.gil_payment`, `type: 'int'`, `defaultValue: 99999`, `nullable: true` | ✓ |
| Backfill all existing rows to 99999 | Achieved automatically by the generated migration's SQLite rebuild-INSERT applying the column default - no manual `UPDATE` needed | ✓ (better than planned - see below) |
| New payments default to 99999 with no payment-logic changes | Confirmed live via `addPaymentToOrder` through the real `dummyPaymentHandler` - zero payment-processing code touched | ✓ |

**One correction to the architecture's plan, verified independently, not just taken from `implementation.md`**: the architecture called for a manual `UPDATE` statement in the migration. I independently re-inspected the actual generated migration file and confirmed it contains **no** `UPDATE` statement at all - only the standard rebuild-table sequence - and yet all 4 existing rows already show `99999`. This is correct SQLite behavior (the rebuild's column-omitting `INSERT...SELECT` applies the new column's `DEFAULT` automatically), not a bug or an incomplete migration. No correction needed to the executed migration; the correction is to the architecture document's assumption, which I'm noting here for the record rather than silently accepting.

## CustomFields vs. Dedicated Table/Column

**Decision: CustomFields - confirmed correct.** A single scalar test field with no relations or independent lifecycle - the same reasoning as every prior customField feature in this project.

## Independent Verification of the Executed Schema

Re-inspected directly:
```
PRAGMA table_info(payment) → ..., ('customFieldsGil_payment', 'INTEGER', 0, '(99999)', 0)  -- nullable, DEFAULT (99999)
SELECT id, customFieldsGil_payment FROM payment → all 5 rows (4 pre-existing + 1 created live during Developer verification) show 99999
SELECT * FROM migrations → includes AddPaymentGilPayment1787813335513
```

## Final Schema

| Table | Column | Type | Nullable | Default | Index |
|---|---|---|---|---|---|
| `payment` | `customFieldsGil_payment` | `INTEGER` | yes | `99999` | none |

No relations introduced. No other column, index, or table touched - confirmed by reading the migration file directly.

## Migration Executed

- **File**: `src/migrations/1787813335513-AddPaymentGilPayment.ts`.
- **Shape**: standard SQLite table-rebuild pattern (required since `payment` has a foreign key to `order`, same as every prior migration in this project). `up()` recreates `payment` with the new column carrying `DEFAULT (99999)` baked into the `CREATE TABLE` statement itself; `down()` reverses it via the same pattern.
- **Applied**: yes, confirmed directly against `vendure.sqlite`.

## Indexes

None added, none needed - an inert integer test field has no query pattern to support.

## Risks

- **None new.** This is the lowest-risk migration run so far in this project: purely additive, database-enforced default, verified to have zero effect on payment processing through a real live payment flow (not just a data insert).
- Same standing note as `customer-giltest-field`: SQLite's table-rebuild pattern holds a stronger lock than a plain `ADD COLUMN` would on a production-scale Postgres/MySQL database - worth remembering if this migration pattern is ever run against a large real `payment` table rather than this project's current 5 rows.

## Verdict

Schema execution matches the architecture with one positive correction (no manual backfill statement was needed, contrary to the architecture's assumption) - noted above, not treated as a defect. Updating the living schema document now.
