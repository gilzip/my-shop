# Implementation

## Files Changed

- **`src/vendure-config.ts`** — added one entry to the existing `customFields.Customer` array:
  ```ts
  {
      name: 'internalNote',
      type: 'text',
      nullable: true,
      public: false,
      label: [{ languageCode: LanguageCode.en, value: 'Internal note' }],
      description: [{
          languageCode: LanguageCode.en,
          value: 'Internal-only note for back-office staff. Never shown to customers.',
      }],
  },
  ```
  The pre-existing `GilTest` entry in the same array was left untouched, per architecture.md's explicit instruction not to conflate this feature with the separate, already-flagged `GilTest` exposure bug.

- **`src/migrations/1787641335045-AddCustomerInternalNote.ts`** — new migration, generated via `npx vendure migrate --generate AddCustomerInternalNote` (not hand-written). Rebuilds the `customer` table (SQLite's ADD COLUMN limitation, same pattern as the two existing migrations on this project) to add a nullable `customFieldsInternalnote TEXT` column, preserving the existing `userId` FK and unique constraint. The generator's diff touched only this new column — it did not include any change to `customFieldsGiltest`, confirming the two features stayed properly isolated.

- **`.ai/api-overview.md`** — appended one line to the "Custom additions" section (done during the Architect stage, verified still accurate): notes that `Customer.internalNote` is reachable only through the existing `customer`/`customers`/`updateCustomer` Admin API operations and is absent from the Shop API's `updateCustomer`/`activeCustomer`/`me`, without adding or removing any top-level operation.

## Behavior Implemented

Internal (Admin API / Dashboard) staff can now read and write a free-text `internalNote` on any `Customer` record, via the existing auto-generated `updateCustomer` mutation and `customer`/`customers` queries — no new resolver, service, or plugin was needed. The field does not appear anywhere in the Shop API schema.

## Verification Performed

No test infrastructure exists in this repository (confirmed in `technical-discovery.md`; still true — no `.spec.ts`/`.test.ts` files anywhere under `src/`), so no unit/integration tests were added, consistent with the prior `variant-internal-note` feature's precedent. Instead, the following were run directly:

1. **Type check**: `npx tsc --noEmit` — passed with no errors.
2. **Migration generation**: `npx vendure migrate --generate AddCustomerInternalNote` — succeeded; resulting migration inspected manually and confirmed to touch only the intended column.
3. **Migration execution**: `npx vendure migrate --run` — applied cleanly ("Successfully ran 1 migrations").
4. **Schema verification against the real running database**: inspected `vendure.sqlite`'s `customer` table directly (`PRAGMA table_info`) and confirmed the new `customFieldsInternalnote TEXT` (nullable) column exists alongside the untouched `customFieldsGiltest` column.
5. **Live GraphQL schema verification**: started the dev server (`npx vendure dev server`) and ran introspection queries against both APIs:
   - Admin API `CustomerCustomFields` type: `[{name: "GilTest", type: "Int"}, {name: "internalNote", type: "String"}]` — new field present and correctly typed.
   - Shop API `CustomerCustomFields` type: `[{name: "GilTest", type: "Int"}]` — `internalNote` correctly absent; confirms `public: false` is working as intended.
   Server was stopped after verification.

This is not a repository under version control (no `.git` found at `C:\vendure` or `C:\vendure\my-shop`), so a `git diff` review as normally called for by this stage was not possible; the file changes above are the complete and only changes made.

## Known Limitations

- No automated tests were added (matches this repo's existing, pre-existing gap — not introduced by this feature).
- The pre-existing `Customer.GilTest` field's Shop API exposure was independently confirmed (again) via the live introspection above, but is intentionally not fixed here — it's already being handled as a separate task.
- No history/audit of the note's value is kept, per the approved business requirement (current-value only).
