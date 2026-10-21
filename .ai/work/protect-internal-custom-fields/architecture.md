# Architecture: protect-internal-custom-fields

## Verified architecture

Every item below was checked independently against the installed `@vendure/core` 3.7.2 and the running server. None of it was taken from the PM documents alone.

1. **`public: false` hides a field from the Shop API for both reading and writing, and keeps it in the Admin API.**
   - `graphql-custom-fields.js:42-44` builds each entity's field list with `!config.internal && (publicOnly === true ? config.public !== false : true)`.
   - The output type and every input derived from it come from that same filtered list: the writeable fields at `:65-66`, sort and filter at `:67-68`, and the register input at `:336`.
   - `generate-resolvers.js:240,254` attaches per-field shop resolvers only when `public !== false`.
2. **Leak guard for all-hidden entities.**
   - When every custom field on an entity is non-public, the Shop API types `customFields` as `JSON`.
   - `generate-resolvers.js:258-266` then sets `shopResolvers[entityName] = { customFields: () => null }` (Vendure issue #3049).
   - This is the last assignment for that key. `:129-131` merges `shopResolvers` shallowly over the error resolvers and common resolvers, so nothing overrides it later. Customer and Payment have no relation custom fields, so `:168-170` never sets them first.
   - **Verdict on the discovery question:** the guard applies to Customer and Payment once all their fields are hidden. It is still proven at runtime with populated data (see Tests). All 6 existing payments hold `gil_payment = 99999`, so real values are available.
3. **`readonly` and `internal` don't fit the requirement.**
   - `readonly` removes the field from the Admin API write inputs too (`:317`), so staff could no longer edit it.
   - `internal` removes the field from the Admin API schema as well (`:43`), so staff could no longer see it.
4. **No schema impact.** `public` is consumed only by the GraphQL schema builder and resolvers. TypeORM column registration does not read it. No migration is needed, and the **DBA stage is skipped.**
5. **The Admin API keeps all fields.**
   - Live unauthenticated introspection of the Admin API returns `CustomerCustomFields { GilTest, internalNote, dror_cust }`.
   - Introspection works without a login, so Story 3's schema check can be automated. Saving edits in the dashboard needs a staff login, so that check is manual.
6. **No operation changes.** Only field visibility on existing types changes. `.ai/api-overview.md` lists operations, not fields, so its operation list needs no update.

## Correction (Developer stage, 2026-10-21): write leak through `JSON` inputs

Point 1 above is incomplete. A live test against the implemented Part A showed this:

- `setCustomerForOrder(input: { …, customFields: { GilTest: 777, dror_cust: "WRITE-CANARY", internalNote: "WRITE-CANARY" } })` **succeeded as a guest**.
- All three values were **persisted** (customer 12).

**Root cause** (`graphql-custom-fields.js:121-149, 151-176`):
- When an entity has **no writable public** custom fields, Vendure does not drop `customFields` from its `Create<Entity>Input` and `Update<Entity>Input`. It types it as `JSON` instead.
- After Part A, Customer is all-hidden, so the Shop API's `CreateCustomerInput.customFields` and `UpdateCustomerInput.customFields` became `JSON`. Live introspection lists five Shop inputs with `customFields: JSON`; only Customer has fields defined.
- `CustomFieldProcessingInterceptor` then matches the JSON keys against **all** configured fields (`custom-field-processing-interceptor.js:210-215`), with no check for `public`.
- Before Part A, the typed input listed only `GilTest` and `dror_cust`. So Part A alone would have **widened** the write exposure to `Customer.internalNote`, and the read leak guard (#3049) has no write-side equivalent.

**Added design (Part C):** `internalByDefault` also attaches a Shop-API write guard to every field that ends up `public: false`. It uses the field's own `validate` hook, an existing Vendure extension point:

- `validateCustomFunction` runs `config.validate(value, injector, ctx)` on every custom field value submitted through either API (`validate-custom-field-value.js:87-97`, called from `:41`).
- The guard returns an error when `ctx.apiType === 'shop'`. Otherwise it delegates to the field's original `validate`, if any.
- Admin API writes are unaffected, and no staff permissions change.

Alternatives considered for Part C:

- **`requiresPermission` (for example `ReadCustomer`/`ReadOrder`/`ReadCatalog`).** It works, since the customer role holds only `Authenticated`. Rejected because the right permission differs per entity and per staff role (for example, `order-manager` lacks `ReadCatalog`). Getting it wrong would reduce staff access, which the business rule forbids.
- **A plugin with a global interceptor.** Rejected because it would be a parallel validation mechanism next to Vendure's own.

**Tests added for Part C:** unit tests for the guard; E2E write-path checks that use `JSON` input (`setCustomerForOrder` with `GilTest`, `dror_cust` and `internalNote`), and that check no value is persisted.

## Proposed design

### Part A: Fix the three leaking fields (Stories 1–4)

- In `src/vendure-config.ts`, add `public: false` to `Customer.GilTest`, `Customer.dror_cust` and `Payment.gil_payment`.
- Mirror the `internalNote` convention: update each description to state "Never shown to customers".
- Keep every other key unchanged (`name`, `type`, `nullable`, `defaultValue`, `label`).

### Part B: "Internal by default" for future fields (Story 5)

Vendure's default is `public: true`, and that default caused all three leaks. This part adds one small config helper.

- **New file:** `src/custom-fields/internal-by-default.ts`.
- **Export:** `internalByDefault(customFields: CustomFields): CustomFields`. For each entity array, it maps each field to `{ public: false, ...field }`.
- **Behavior:**
  - A field that omits `public` becomes hidden from customers.
  - A field that states `public: true` stays exposed. Exposing a field is therefore always a visible, deliberate line in the config.
  - Explicit `public: false` and every other key pass through unchanged.
- **Usage:** `src/vendure-config.ts` wraps its block as `customFields: internalByDefault({ ... })`.
- **Why both parts:** Part A keeps the explicit `public: false` on the three fields as documentation of intent, and stays correct if the wrapper is ever removed. Part B protects the next field someone adds.

**Documentation:** add a "Custom fields" rule to `AGENTS.md`, which future pipeline stages read. It says:
- custom fields are customer-invisible by default, through `internalByDefault`;
- exposing a field requires `public: true`, with a reason in its description.

## Files to create or modify

| File | Change |
|---|---|
| `src/vendure-config.ts` | Add `public: false` and descriptions on 3 fields; wrap `customFields` in `internalByDefault(...)`; import it |
| `src/custom-fields/internal-by-default.ts` | **New**: the helper (about 15 lines, `import type` only from `@vendure/core`) |
| `test/internal-by-default.test.ts` | **New**: unit tests (see below). Kept outside `src/` so `tsc` does not emit it into `dist/` (`tsconfig.json` includes `src/**/*.ts`) |
| `package.json` | Add `"test": "node --test test/"`. Node 24.19 strips TypeScript types natively, so no new dependency is needed |
| `AGENTS.md` | Add the custom-fields visibility rule |
| `.ai/schema-overview.md` | Update the "exposed to Shop API" column for the 3 fields to "no", and remove GilTest's "known bug" note (living doc). The DBA stage is skipped, so the Developer owns this |

## Registration and configuration

None beyond `vendure-config.ts`. No plugin, migration or environment variable is needed. The server needs a restart to rebuild the GraphQL schema; `vendure dev` restarts it on file change.

## Frontend and storefront implications

None.
- `C:\vendure\storefront` has zero references to `customFields`, `GilTest`, `dror_cust` or `gil_payment`.
- Its generated `graphql-env.d.ts` doesn't contain them either.
- The storefront needs no regeneration. A full checkout run is the regression check (Story 4).

## Tests to add

1. **Unit tests** (`node --test`) for `internalByDefault`:
   - an omitted `public` becomes `false`;
   - explicit `public: true` is kept;
   - explicit `public: false` is kept;
   - other keys, such as `defaultValue: 99999`, are preserved;
   - entities with empty or undefined arrays are handled;
   - the input object is not mutated.
2. **Acceptance E2E**: extend the 2026-10-21 Shop API script and run it against the restarted server.
   - **Introspection:** `GilTest`, `dror_cust`, `gil_payment` and `internalNote` appear in no Shop API type. `CustomerCustomFields`, `PaymentCustomFields` and the three customer inputs are absent.
   - **Populated leak check, Customer:** create a guest order with `setCustomerForOrder`. As a test fixture, set that customer's `customFieldsGiltest` and `customFieldsDror_cust` in SQLite. Back up the database first and restore it afterwards. Then `activeOrder { customer { customFields } }` must return `null`.
   - **Populated leak check, Payment:** pay, then `orderByCode { payments { customFields } }` must return `null`. The stored `gil_payment` must be `99999`, which proves the default still applies.
   - **Write paths:** `setCustomerForOrder`, `registerCustomerAccount` and `updateCustomer` with `customFields: { GilTest: 1 }` must be rejected by GraphQL validation. The first and the last are the minimum to exercise.
   - **Admin:** introspection shows all five fields, in the output types and in `UpdateCustomerCustomFieldsInput` / `UpdateProductVariantCustomFieldsInput`.
   - **Data:** row values for all five columns are identical before and after (snapshot diff), and the `migrations` table is unchanged.
   - **Regression:** the existing 21 checks still pass.
3. `npx tsc --noEmit` and `npm run build:server` pass.

## Risks

- **Fields added by future plugins bypass the wrapper.** A plugin adds fields through its own `configuration` hook, after `customFields` is evaluated. There are no custom plugins today. Mitigation: the `AGENTS.md` rule tells plugin authors to set `public` explicitly. Revisit when the first plugin adds custom fields (see the rejected plugin alternative below).
- **Surprise for developers who expect Vendure's default.** Mitigated by the helper's doc comment and the `AGENTS.md` rule.
- **All-hidden `JSON` type.** Shop API clients that query `customer { customFields }` now get `null` typed as `JSON` instead of an object type. No client does this today: the storefront doesn't, and the rest is the test script.
- **Leak guard is framework behavior.** A future Vendure upgrade could regress #3049. The populated-value E2E check exists to catch exactly that.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| `readonly: true` | Customers could still **read** the fields, and staff could no longer edit them |
| `internal: true` | Removes the fields from the Admin API and dashboard, which breaks the staff-access rule |
| `requiresPermission` with an admin-only permission | Heavier than needed; the business needs no per-role rules (no staff role is restricted) |
| A startup check that throws when `public` is missing | Meets "flagged before ship", but it fails safe by crashing the server instead of by hiding the field. The wrapper meets the "hidden by default" wording directly |
| A guard plugin that rewrites fields in its `configuration` hook | Would also cover fields added by plugins, but correctness depends on the plugin being **last** in the `plugins` array, an implicit ordering rule. No custom plugins exist yet, so this is deferred (see Risks) |
| Deleting the test fields | Out of scope; the stakeholder decided to keep them |
