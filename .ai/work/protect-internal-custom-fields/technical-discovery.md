# Technical Discovery: protect-internal-custom-fields

## Business requirement summary

Customers must not see or change internal/test data fields. In scope: `Customer.GilTest`, `Customer.dror_cust` and `Payment.gil_payment`. `ProductVariant.internalNote` and `Customer.internalNote` must stay hidden. Back-office staff keep full read/write access in the Admin API and dashboard. Stored values are untouched. New internal fields must be internal by default, and exposing a field to customers must be a stated decision. Stakeholder decisions (2026-10-21): the test fields stay, and no staff role is restricted.

## Existing capability

All five custom fields are declared in `src/vendure-config.ts` under `customFields`. Vendure 3.7.2 offers four flags that control API visibility. The table below shows how each flag behaves in the installed `@vendure/core`:

| Flag | Shop API (read) | Shop API (write) | Admin API (read/write) | Source |
|---|---|---|---|---|
| `public: false` | hidden | hidden | **kept** | `api/config/graphql-custom-fields.js:43` (`publicOnly === true ? config.public !== false : true`); `:336` (register input); `generate-resolvers.js:240,254` (no shop resolver) |
| `readonly: true` | visible | hidden | read-only **for staff too** | `graphql-custom-fields.js:65-66,317` |
| `internal: true` | hidden | hidden | **hidden from staff too** | `graphql-custom-fields.js:43` (`!config.internal`) |
| `requiresPermission` | per permission | per permission | per permission | `custom-field-types.d.ts:25`. Customers hold only Authenticated/Owner permissions |

`public: false` is the only flag that meets every rule: hidden from customers for both reading and writing, and fully available to staff. It is also the convention this repo already uses: both `internalNote` fields already have `public: false`.

**Default:** `public` defaults to `true` (`custom-field-types.d.ts`: "Whether the custom field is available via the Shop API. @default true"). This framework default is why the three test fields leaked: they omit the key.

## Current exposure (live Shop API introspection, 2026-10-21, server on :3000)

| Shop API type | Fields today | Customer path that uses it |
|---|---|---|
| `CustomerCustomFields` | `GilTest`, `dror_cust` | `activeCustomer`, the order's `customer` |
| `UpdateCustomerCustomFieldsInput` | `GilTest`, `dror_cust` | `updateCustomer` (signed-in customer edits own record) |
| `RegisterCustomerCustomFieldsInput` | `GilTest`, `dror_cust` | `registerCustomerAccount` |
| `CreateCustomerCustomFieldsInput` | `GilTest`, `dror_cust` | `setCustomerForOrder` (guest checkout) |
| `PaymentCustomFields` | `gil_payment` | `activeOrder.payments`, `orderByCode.payments` |
| `ProductVariant.customFields` | `JSON` scalar, forced to `null` | none (see below) |

So customers can write the test fields through **three** paths, not only through account editing: account update, registration, and guest checkout. The business requirement only named account editing.

## Existing architecture relevant to this domain

- Custom fields are configuration, not plugins. There is no custom plugin in `src/plugins` (the folder is empty).
- Shop/Admin schema split: `addGraphQLCustomFields(typeDefs, customFields, publicOnly)`. The Shop API is built with `publicOnly = true`.
- **When all of an entity's custom fields are non-public**, the Shop API types `customFields` as a generic `JSON` scalar. To prevent leaking the full object, Vendure forces the shop resolver to return `null` (`generate-resolvers.js:258-266`, Vendure issue #3049). `ProductVariant` is in this state today. After this feature, `Customer` and `Payment` will be in it too, so this guard becomes load-bearing for them.

## Similar implementations

- `ProductVariant.internalNote` (`variant-internal-note`) and `Customer.internalNote` (`customer-gil-tzipori-field`) both use `public: false` plus a label/description stating "Never shown to customers". Their architecture docs confirm that `public: false` alone is sufficient and no extra guard is needed.

## Existing business rules encoded in the system

- `Payment.gil_payment` has a DB-level `DEFAULT (99999)` (`.ai/schema-overview.md`), and existing rows have values. Visibility must not touch that default.
- `Customer.GilTest`: 5 of 9 customers hold `9999` (backfilled by migration `1787549554034-AddCustomerGilTest.ts`), and 4 are `null`.
- `.ai/schema-overview.md` already lists GilTest's exposure as a "known, separately-tracked bug". This feature is that fix.

## Relevant tests

- The project has no automated tests: no `*.spec.ts` or `*.test.ts` files, and no `test` script in `package.json`.
- The only existing verification is the ad-hoc E2E script from 2026-10-21 (Shop API introspection plus full checkout). It found this issue and can verify the fix.

## Reuse opportunities

- Reuse the `public: false` pattern and label/description wording from the two `internalNote` fields.
- Reuse the E2E checks: introspection of the six Shop API types listed above, plus a full checkout to show normal shopping is unaffected.

## Required changes

- Set the three test fields to customer-invisible (`public: false` is the established mechanism; the final choice is the Architect's).
- Introduce a mechanism or convention that makes "internal by default" hold for future fields, since the framework default is the opposite. The Architect chooses between, for example, a startup/config check and a documented convention.
- Update the living docs (`.ai/schema-overview.md`, `.ai/api-overview.md`) so the exposure column reflects the new state, and so GilTest is no longer listed as a known bug.

## New business behavior

- Customers can no longer read or write `GilTest`, `dror_cust` or `gil_payment` through any Shop API path. For Customer and Payment, `customFields` in the Shop API returns `null`.
- Staff behavior is unchanged.

## Schema impact

None expected. `public` only shapes the GraphQL schema and resolvers, not TypeORM column metadata, so no columns, defaults or values change. The Architect and DBA should confirm this. If confirmed, the DBA stage is skipped.

## Relevant files

- `src/vendure-config.ts` (the `customFields` block)
- `node_modules/@vendure/core/dist/api/config/graphql-custom-fields.js`, `.../generate-resolvers.js`, `.../config/custom-field/custom-field-types.d.ts` (evidence only)
- `.ai/schema-overview.md`, `.ai/api-overview.md` (living docs)
- `C:\vendure\storefront`: greps for `customFields`, `GilTest`, `dror_cust` and `gil_payment` found zero uses, so the storefront does not depend on these fields.

## Evidence from source

```js
// graphql-custom-fields.js:42-44: Shop schema excludes non-public fields
const customEntityFields = customFields.filter(config => {
    return !config.internal && (publicOnly === true ? config.public !== false : true);
});
// generate-resolvers.js:258-266: JSON leak guard
const allCustomFieldsAreNonPublic = customFields.length && customFields.every(f => f.public === false || f.internal === true);
if (allCustomFieldsAreNonPublic) { shopResolvers[entityName] = { customFields: () => null }; }
```

## Open questions

None for the business. For the Architect:
1. **Enforcing "internal by default":** a runtime check, a lint, or a documented convention?
2. **Leak guard verification:** confirm the JSON leak guard actually returns `null` for Customer and Payment with **populated** values. The only existing all-hidden entity, ProductVariant, has no stored `internalNote` values today, so the guard is unproven with real data in this repo.
