# Schema Execution: Customer dror_cust Field

## Developer's Work vs. Spec/Architecture

| Called for | What was built | Match? |
|---|---|---|
| Nullable text field, no default | `type: 'text'`, `nullable: true`, no `defaultValue` | ✓ |
| No backfill | Migration contains no `UPDATE` - all rows `NULL` | ✓ |
| Pre-existing `GilTest`/`internalNote` untouched | Re-verified directly - both entries and their DB values unchanged | ✓ |

No corrections needed.

## CustomFields vs. Dedicated Table/Column

**Decision: CustomFields - confirmed correct.** Same reasoning as every prior field in this series.

## Independent Verification of the Executed Schema

```
PRAGMA table_info(customer) → includes ('customFieldsDror_cust', 'TEXT', 0, NULL, 0) - nullable, no default
SELECT id, customFieldsGiltest, customFieldsInternalnote, customFieldsDror_cust FROM customer → all 9 rows: dror_cust is NULL; giltest/internalnote values match pre-migration state exactly
SELECT * FROM migrations → includes AddCustomerDrorCust1787823937827
```

## Final Schema

| Table | Column | Type | Nullable | Default | Index |
|---|---|---|---|---|---|
| `customer` | `customFieldsDror_cust` | `TEXT` | yes | none | none |

No relations, no other columns touched.

## Migration Executed

- **File**: `src/migrations/1787823937827-AddCustomerDrorCust.ts`.
- **Shape**: standard SQLite rebuild pattern, correctly carrying forward both pre-existing customField columns in the `INSERT...SELECT` column list.
- **Applied**: yes, confirmed directly against `vendure.sqlite`.

## Indexes

None added, none needed.

## Risks

None beyond the standing SQLite-rebuild-lock note already carried in every prior schema-execution.md for this project.

## Verdict

Matches architecture exactly. Updating the living schema document now.
