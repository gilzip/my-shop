# Implementation: Customer dror_cust Field

No `git diff` available (pre-existing gap). Files described directly.

## Files Changed

- **`src/vendure-config.ts`** (modified) — appended a third entry to the existing `customFields.Customer` array: `dror_cust`, `type: 'text'`, `nullable: true`, no `defaultValue`. The two pre-existing entries (`GilTest`, `internalNote`) were read directly before editing and left untouched.
- **`src/migrations/1787823937827-AddCustomerDrorCust.ts`** (created, used exactly as generated) — adds `customFieldsDror_cust TEXT` (no default) to `customer` via the standard SQLite rebuild pattern; the rebuild's `INSERT...SELECT` explicitly carries over the existing `customFieldsGiltest`/`customFieldsInternalnote` values column-by-column.

## Tests Run (and results)

1. **Type-check** and **production build** — both passed cleanly.
2. **Migration run**, verified directly against the DB: all 9 customer rows show `customFieldsDror_cust = NULL` (Story 2). The 5 original customers retain `customFieldsGiltest = 9999`; all rows show `customFieldsInternalnote = NULL` (unchanged from before this migration - it was never set) (Story 3).
3. **Boot test**: server started cleanly twice (once via a plain boot check, once to also verify introspection) with no schema/config errors.
4. **Live Admin API introspection**: `CustomerCustomFields` now lists all three fields - `GilTest: Int`, `internalNote: String`, `dror_cust: String` - confirming Story 1 and that nothing was dropped from the two pre-existing fields.

## Known Limitations

No automated test covers this - verification was real but manual, same standing gap as every prior feature.
