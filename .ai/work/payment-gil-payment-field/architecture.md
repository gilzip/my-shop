# Architecture: Payment gil_payment Field

## Verified Architecture

Re-confirmed both discovery claims directly:
- `Payment?: CustomFieldConfig[]` in the installed `@vendure/core`'s `CustomFields` type.
- `register-custom-entity-fields.js`'s `getDefault()` feeds `customField.defaultValue` straight into the generated TypeORM column's `default` option — a real database-level default, not a UI-only convenience. No claim needed correction.

## Proposed Design

1. **`vendure-config.ts`**:
   ```ts
   customFields: {
       // ...existing ProductVariant, Customer entries unchanged
       Payment: [
           {
               name: 'gil_payment',
               type: 'int',
               defaultValue: 99999,
               nullable: true,
               label: [{ languageCode: LanguageCode.en, value: 'gil_payment (pipeline test field)' }],
               description: [{ languageCode: LanguageCode.en, value: 'Internal pipeline test field - defaults to 99999, no business meaning.' }],
           },
       ],
   },
   ```
2. **Migration**: generate via `npx vendure migrate --generate`, then add one `UPDATE "payment" SET "customFieldsGil_payment" = 99999` statement to `up()`, backfilling the 4 existing rows - mirroring `customer-giltest-field`'s pattern exactly. `down()` needs no special handling beyond dropping the column (same precedent).

## Files to Create/Modify

- **Modify**: `src/vendure-config.ts`.
- **Create**: one migration under `src/migrations/`.

## Tests to Add

1. Confirm all 4 existing rows show `99999` via direct DB query (Story 1).
2. **Drive a real Payment through the existing live checkout flow** (add item, set customer, add payment via the dummy handler) and confirm the newly created Payment row shows `99999` without any code change to payment logic (Story 2) - this is the one genuinely new verification shape in this feature, since no prior feature has proven a `defaultValue` claim through a live insert rather than just reading the config.
3. Confirm payment state/amount/handler behavior is unchanged (Story 3).

## Risks

Negligible - inert additive field, defaultValue is a standard, already-existing customField option, not new mechanism. The one risk worth naming: if any future code ever explicitly lists `gil_payment` in an insert without a value, TypeORM/the DB fills in `99999` transparently - correct and intended, but worth remembering this column will never silently be `NULL` for new rows the way `internalNote`/`GilTest` can be, since neither of those set a `defaultValue`.

## Rejected Alternatives

- **Setting the default via application code** (e.g. a Payment-creation hook) instead of `defaultValue`. Rejected - the database-level default already achieves this with zero code touching payment logic, which is both simpler and structurally safer against the "must not affect payment processing" business rule than adding a hook into the payment creation path would be.
