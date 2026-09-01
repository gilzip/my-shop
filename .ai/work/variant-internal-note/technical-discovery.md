# Technical Discovery

## Business Requirement Summary

An optional free-text "internal note" field on `ProductVariant`, editable and visible only to admin/back-office users, never exposed to the storefront or any customer-facing surface.

## Existing Capability

This project (`my-shop`) is a stock, unmodified Vendure 3.7.2 install — no custom entities, no `customFields`, no migrations exist yet (confirmed against `node_modules/@vendure/core` and `src/vendure-config.ts`, and previously documented in `.ai/schema-overview.md`). There is currently no mechanism at all for staff to attach notes to a variant.

## Relevant Architecture: Vendure's CustomFields mechanism

Vendure ships a first-class extension point for exactly this shape of requirement: `customFields` in `vendure-config.ts`. Confirmed directly from `node_modules/@vendure/core/dist/config/custom-field/custom-field-types.d.ts`:

- `CustomFields` is a config object keyed by entity name; `ProductVariant` is one of the explicitly supported keys.
- Each field definition supports (among others): `name`, `type`, `nullable`, `defaultValue`, `label`, `description`, `ui`, and critically **`public?: boolean` (default `true`) — "Whether the custom field is available via the Shop API."**

This is a business rule already encoded in the framework, not something we need to invent: setting `public: false` is Vendure's built-in mechanism for "admin-only, never customer-facing," which is exactly what the business requirement asks for.

## Similar Implementations

No prior custom field exists in this project to copy from (this is the first). The relevant precedent is Vendure's own documented pattern (JSDoc example in the type file itself):

```ts
User: [
    { name: 'socialLoginToken', type: 'string', public: false },
],
```

This is the same `public: false` pattern this feature needs, just on `ProductVariant` instead of `User`.

## Existing Business Rules Encoded in the System

Traced through `node_modules/@vendure/core/dist/api/config/graphql-custom-fields.js` and `get-final-vendure-schema.js`:

- The Admin API schema is built with `publicOnly = false`, so **every** non-internal custom field is included regardless of `public`.
- The Shop API schema is built with `publicOnly = true`, so fields with `public: false` are **omitted from the schema entirely** — not just permission-gated at resolve time, the field literally does not exist in the Shop API's SDL.

This means `public: false` gives a stronger guarantee than an access check: there's no code path in the Shop API that could accidentally leak the field, because it isn't there to query.

## Relevant Tests

None exist in this project (confirmed: no test framework configured at all — separate pre-existing gap, not something to fix as part of this feature). The installed `@vendure/core` npm package does not ship its own e2e test fixtures, so no local example test could be inspected for this exact shape; the config shape below is derived from the schema-generation source code itself, not a test.

## Reuse Opportunities

- **Full reuse** of Vendure's CustomFields mechanism — no new entity, table, resolver, or API code needed.
- **Full reuse** of the Dashboard's existing variant detail page: `node_modules/@vendure/dashboard/src/app/routes/_authenticated/_product-variants/product-variants_.$id.tsx` already renders `<CustomFieldsPageBlock column="main" entityType="ProductVariant" .../>`, which resolves fields dynamically from server config (`useCustomFieldConfig('ProductVariant')`). Any new `ProductVariant` custom field appears there automatically — no Dashboard code changes needed.
- **Full reuse** of the Admin API's dynamic schema generation — `internalNote` will appear at `ProductVariant.customFields.internalNote` with no manual GraphQL schema edits.

## Required Changes

1. Add one entry to `customFields.ProductVariant` in `src/vendure-config.ts`.
2. Generate and commit a migration (`npx vendure migrate`) since this project runs with `synchronize: false` and has no `src/migrations` directory yet — this will be the **first** migration this project has ever had.

## New Business Behavior

None beyond what's in the business requirement — this is a straight application of an existing framework mechanism, not new business logic.

## Relevant Files

- `src/vendure-config.ts` — where the `customFields` config is added.
- `src/migrations/` — does not exist yet; will be created by the DBA stage running `npx vendure migrate`.
- `node_modules/@vendure/dashboard/src/app/routes/_authenticated/_product-variants/product-variants_.$id.tsx` — confirms Dashboard auto-renders the field (read-only reference, not to be modified).

## Evidence from Source

- `node_modules/@vendure/core/dist/config/custom-field/custom-field-types.d.ts` — `public?: boolean` definition and `ProductVariant` key.
- `node_modules/@vendure/core/dist/api/config/graphql-custom-fields.js:42-44` — the `publicOnly` filter that excludes `public: false` fields from the Shop API schema.
- `src/vendure-config.ts:45-53` and `src/index.ts` — confirms `synchronize: false` and that `runMigrations()` runs before `bootstrap()` on every start, so a generated migration will apply automatically.
- `README.md` (Migrations section) — documents the `npx vendure migrate` workflow this project expects.

## Open Questions

None blocking. One judgment call made here rather than escalated: `type: 'text'` (multi-line) was chosen over `'string'` (single-line, shorter) since the business requirement says the field should hold "at least a few sentences" — this is confirmed as a valid `CustomFieldType` value in the same type file, not an assumption from general Vendure knowledge.
