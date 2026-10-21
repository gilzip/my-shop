# Review: protect-internal-custom-fields

**Reviewed:** 2026-10-21
**Code under review:** this feature's hunks in commit `62fe3e7`: `src/vendure-config.ts` (the `customFields` block), `src/custom-fields/internal-by-default.ts`, `test/internal-by-default.test.ts`, and the `test` script in `package.json`. Also the uncommitted `AGENTS.md` and `.ai/schema-overview.md` changes.
**Method:** `implementation.md` was treated as a claim. The committed code was read directly, the framework paths it relies on were re-traced, and the behavior was probed independently against the running server (`start:server` built from current `main`) and the storefront.

## 1. Business request satisfaction: met

| Business rule | Evidence |
|---|---|
| 1–2. Internal/test fields hidden from customers and not changeable by them | The acceptance script scans all 257 Shop types and finds none of the 5 names. Populated canary values on Customer, and `99999` on Payment, read back as `customFields: null`. Writes are rejected on `setCustomerForOrder` (all 3 customer fields), `registerCustomerAccount` and `updateCustomer`, and nothing is persisted. **Independently re-probed:** `customFields: { GilTest: null }` is also rejected |
| 3. Internal notes stay hidden | Same scan. `Customer.internalNote` is now also write-guarded; it was writable through the JSON input between Part A and Part C |
| 4. Staff access not reduced | Admin introspection shows all 5 fields in the output and update-input types. No `requiresPermission`, `internal` or `readonly` was used. The guard's Admin branch delegates to the original `validate` (unit-tested). One gap remains: an actual dashboard edit was not exercised (see Notes) |
| 5. Existing values kept | Snapshot diff over 75 customers, 71 payments and 89 variants is identical; the `migrations` table is unchanged |
| 6. Internal by default | `internalByDefault` gives `public: false` plus the guard to any field that omits `public`; `public: true` is required to expose a field. Documented in `AGENTS.md` |

## 2. Reuse of Vendure extension points: good

The feature uses only the custom-field config flags (`public`) and the field's own `validate` hook. I re-traced `validate-custom-field-value.js:87-97` and `custom-field-processing-interceptor.js:210-215`: Vendure calls `validate(value, injector, ctx)` for every submitted key, from both APIs and from `JSON` inputs. There is no interceptor, plugin or permission scheme alongside Vendure's own mechanisms. The rejected alternatives are reasoned and correct; in particular, `requiresPermission` would have needed per-role tuning (`order-manager` lacks `ReadCatalog`).

## 3. Preservation of existing behavior: preserved

- The 2026-10-21 regression suite passes 21/21: checkout, first-order discount, both payment methods, free shipping Israel, buy X get Y, and edge cases.
- **Independently checked:** the interceptor fills in defaults only for keys sent explicitly as `null` (`custom-field-processing-interceptor.js:172`). So the guard cannot block a create the customer didn't populate. A live guest `setCustomerForOrder` with `customFields: {}` and with `{ unknownKey: 1 }` succeeds.
- **Independently checked:** a storefront (`:3001`) checkout reaches the payment step with no GraphQL errors. It shows the first-order discount, FREE shipping and both payment methods. The only console errors are Next.js HMR WebSocket reconnects, and the storefront log's `ECONNREFUSED` entries date from earlier server restarts.
- **Payment default:** new payments still store `gil_payment = 99999`.

## 4. Coherent multi-step behavior: applicable to read/write symmetry, coherent

Reading and writing are now symmetric on the Shop API. Reads are hidden by the schema and by the `null` guard (#3049); writes are blocked by the schema where an input is typed, and by the `validate` guard where it is `JSON`. The architecture "Correction" section records why Part A alone was asymmetric (read-safe but write-widening), and the fix closes exactly that gap. Good catch by the Developer stage, documented before coding.

## 5. Registration and configuration: correct

- `customFields: internalByDefault({...})` is in `vendure-config.ts`, and the import is present.
- The three fields carry explicit `public: false` as documentation, in addition to the wrapper.
- `tsc --noEmit` and `build:server` pass.
- The wrapper returns a fresh object and does not mutate the input (unit-tested).
- The new plugins in `main` (order self-cancellation, waitlist) add no custom fields, so nothing bypasses the wrapper today.

## 6. Test coverage: adequate, with gaps

- **Unit tests:** 9 tests cover the defaulting, explicit true/false, key preservation, empty and undefined arrays, non-mutation, Shop rejection, Admin pass-through and delegation to the original `validate`. `npm test` passes 15/15, including 6 waitlist tests.
- **E2E:** 22 acceptance checks plus 21 regression checks, including populated-value leak checks, the hard case.
- **Gaps (non-blocking):**
  - `updateCustomer` was exercised only as an anonymous caller. The guard fires inside the interceptor, before authorization, so the rejection is the guard's, but a signed-in-customer case was not run.
  - The E2E script lives in `.ai/work/.../e2e-protect.mjs` with hard-coded local paths. It is not part of `npm test`, and turning it into a standing suite was explicitly out of scope.

## 7. Focused scope: focused

The feature's hunks are limited to the files listed in `implementation.md`. The other changes in `62fe3e7` (order self-cancellation plugin, `.claude/skills`, untracking `.env`/`vendure.sqlite`) and all of `62b0f97` belong to another session and were **excluded from this review**, not judged.

## 8. No unnecessary infrastructure: none added

- One 47-line helper and one test file.
- `node --test` with Node's built-in type stripping; no new dependency.

## Notes for the stakeholder (non-blocking)

1. **Process:** this feature's code reached `main` (commit `62fe3e7`, by another session) **before** this review. The verdict below applies to the code as it now stands in `main`. Going forward, keep one session per checkout, or commit only after the review.
2. **Manual check:** sign in to the dashboard and edit `GilTest` on one customer once, to confirm the Admin path end to end. That needs credentials the pipeline does not have.
3. **Uncommitted docs:** `AGENTS.md`, `.ai/schema-overview.md` and this feature's `implementation.md`, `review.md` and `e2e-protect.mjs` are not committed yet.

PASS
