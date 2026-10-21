# Implementation: protect-internal-custom-fields

## Files changed

| File | Change | Where it is now |
|---|---|---|
| `src/vendure-config.ts` | `public: false` added to `Customer.GilTest`, `Customer.dror_cust` and `Payment.gil_payment`, each description now ends "Never shown to customers."; `customFields` wrapped in `internalByDefault(...)`; import added | committed in `62fe3e7` (see Note) |
| `src/custom-fields/internal-by-default.ts` | **New.** Defaults `public` to `false`, and adds a Shop-API write guard to every non-public field through its `validate` hook | committed in `62fe3e7` |
| `test/internal-by-default.test.ts` | **New.** 9 unit tests | committed in `62fe3e7` |
| `package.json` | `"test": "node --test \"test/**/*.test.ts\""` | committed in `62fe3e7` |
| `AGENTS.md` | New "Custom Fields" section; `npm test` added to Commands | uncommitted |
| `.ai/schema-overview.md` | Shop API exposure column for the 3 fields set to "no"; GilTest "known bug" note replaced with "fixed"; general visibility-rule note added | uncommitted |
| `.ai/work/protect-internal-custom-fields/architecture.md` | Correction section (Part C, JSON write leak), added before coding continued | committed in `62fe3e7` |
| `.ai/work/protect-internal-custom-fields/e2e-protect.mjs` | Acceptance script, for the Reviewer to rerun | uncommitted |

**Note:** another Claude session working on the same checkout committed the in-progress files above together with its own unrelated work. These are commit `62fe3e7` ("Add SDLC pipeline artifacts, order self-cancellation plugin and custom-field work") and `62b0f97` (waitlist plugin), both on `main`, before this feature's review. The feature's code in `HEAD` is identical to the final version here: `git diff HEAD` shows only the uncommitted docs. The Reviewer should therefore review the feature's hunks inside `62fe3e7`, not the whole commit.

## Behavior implemented

- **Shop API reads:** `GilTest`, `dror_cust`, `gil_payment` and both `internalNote` fields appear in no Shop API type. Customer and Payment are now all-hidden, so their Shop `customFields` is the `JSON` scalar, and Vendure forces it to `null` (#3049 guard), even when values are stored.
- **Shop API writes:**
  - `RegisterCustomerInput` has no `customFields` at all.
  - `CreateCustomerInput.customFields` and `UpdateCustomerInput.customFields` are `JSON`, but any attempt to set a hidden field there is rejected with `Custom field "<name>" cannot be set via the Shop API.`, and nothing is persisted.
- **Admin API:** unchanged. All five fields are in the output types and the update inputs, and the guard delegates to the field's own `validate` on Admin writes.
- **Data:** no migration, and no stored value changes. `gil_payment`'s `99999` default still applies to new payments.
- **Future fields:** omitting `public` now means hidden plus write-guarded. Exposing a field needs `public: true`.

## Deviation from the original architecture

Part A on its own (`public: false`) widened the write exposure: a guest could set `GilTest`, `dror_cust` **and** `Customer.internalNote` through the `JSON` input. This was found by a live write test and fixed by Part C (the `validate` guard). It is documented in `architecture.md` under "Correction" before the fix was coded.

## Tests run

All runs were on 2026-10-21, against the compiled server built from the current `main` (`npm run start:server`).

| Check | Result |
|---|---|
| `npm test` (node:test) | 15/15 pass: 9 for this feature, 6 from the waitlist feature |
| `npx tsc --noEmit` | pass |
| `npm run build:server` | pass |
| Acceptance `e2e-protect.mjs` (Stories 1–4) | **22/22 pass**: Shop schema scan (257 types), 5 removed types, JSON mode, 3 JSON write attempts rejected and not persisted, register rejected, `updateCustomer` rejected, populated-value read leak checks for Customer (canary values) and Payment (`99999`), 5 Admin schema checks, data snapshot identical, migrations unchanged |
| Regression (2026-10-21 E2E suite) | **21/21 pass**: checkout, first-order discount, Apple Pay simulated, standard payment, free shipping Israel, buy X get Y |

## Known limitations

- **Plugin-added fields bypass the wrapper.** Custom fields added by a plugin's own `configuration` hook bypass `internalByDefault`; `AGENTS.md` instructs plugin authors to set `public` explicitly. Neither of today's plugins (order self-cancellation, waitlist) adds custom fields.
- **Dashboard editing was not exercised.** The Admin side was verified by schema introspection and by unit-testing the guard's Admin path. Editing in the dashboard needs a staff login, so the stakeholder should do one manual edit of, for example, `GilTest`.
- **Test rows left in the database.** The acceptance script writes canary values and creates test customers and orders in the shared `vendure.sqlite`. This time they were left in place, because another session uses the same database. Earlier in this stage the database was restored from an 11:56 backup, which may have overwritten that other session's data (see the conversation log).
- **Guard error message.** The Shop error names the field (`Custom field "GilTest" …`). This reveals only a name the caller already sent.
- **Dev server watcher.** The `vendure dev` file watcher crashes (`EPERM watch vendure.sqlite-journal`) when the database file is written from outside the server. This is a dev-tooling issue and not caused by this feature; verification used `start:server`.
