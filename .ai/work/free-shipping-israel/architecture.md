# Architecture: Free Shipping for Israel Orders Over 200 ILS

## Verified Architecture

Independently re-confirmed every load-bearing claim from `technical-discovery.md` (not taken on the Technical PM's word):

1. **`mergeConfig` replaces arrays wholesale, does not merge them.**
   `node_modules/@vendure/core/dist/config/merge-config.js:13-14`: *"Arrays do not get merged, they are treated as a single value that will be replaced. So if merging the `plugins` array, you must explicitly concatenate the array."*
   `node_modules/@vendure/core/dist/config/default-config.js:160-162` confirms the framework default is `shippingOptions: { shippingEligibilityCheckers: [defaultShippingEligibilityChecker], shippingCalculators: [defaultShippingCalculator] }`. This project's `vendure-config.ts` has no `shippingOptions` block, so it currently inherits exactly this default. **If the new config sets `shippingEligibilityCheckers` to only the new checker, `standard-shipping`/`express-shipping` (which reference `default-shipping-eligibility-checker` by code) lose their checker at runtime.** This is a real risk, not a hypothetical one, and directly threatens Story 3.

2. **`order.shippingAddress.countryCode` and `order.subTotalWithTax` are the correct fields.**
   `node_modules/@vendure/core/dist/entity/order/order.entity.d.ts:79` (`shippingAddress: OrderAddress`) and `:100` (`subTotalWithTax: number`) — both confirmed present exactly as discovery claimed.

3. **No dedicated free-shipping primitive exists** — confirmed no "isFree" flag anywhere in the `ShippingMethod`/`CreateShippingMethodInput` schema. Reusing `defaultShippingCalculator` with `rate: 0` is a legitimate, framework-native way to produce free shipping, not a workaround.

No claim needed correction. The array-replacement risk is the single most important thing this architecture must design around.

## Proposed Design

**1. New checker file** `src/shipping-methods/free-shipping-israel-checker.ts`:

```ts
import { LanguageCode, Order, ShippingEligibilityChecker } from '@vendure/core';

export const freeShippingIsraelChecker = new ShippingEligibilityChecker({
    code: 'free-shipping-israel-checker',
    args: {
        orderMinimum: {
            type: 'int',
            defaultValue: 20_000, // 200 ILS in minor units
            ui: { component: 'currency-form-input' },
            label: [{ languageCode: LanguageCode.en, value: 'Minimum order value (minor units)' }],
        },
    },
    check: (ctx, order: Order, args) => {
        return order.shippingAddress?.countryCode === 'IL'
            && order.subTotalWithTax >= args.orderMinimum;
    },
});
```

Optional-chaining on `shippingAddress?.countryCode` handles Story 2's edge case (no address set yet, or malformed address) by falling through to `false` rather than throwing.

**2. `vendure-config.ts` change** — add a `shippingOptions` block that explicitly includes the existing defaults alongside the new checker, exactly to avoid the array-replacement risk:

```ts
shippingOptions: {
    shippingEligibilityCheckers: [defaultShippingEligibilityChecker, freeShippingIsraelChecker],
    shippingCalculators: [defaultShippingCalculator],
},
```

`defaultShippingCalculator` only needs to be listed once (both existing methods and the new one can reuse it — the new method just sets its `rate` arg to `0`). Both `defaultShippingEligibilityChecker` and `defaultShippingCalculator` need to be imported from `@vendure/core` into `vendure-config.ts`.

**3. New `ShippingMethod` row** — created via the existing `createShippingMethod` Admin API mutation (already confirmed available, no new API surface needed):

```graphql
createShippingMethod(input: {
  code: "free-shipping-israel"
  fulfillmentHandler: "manual-fulfillment"
  checker: { code: "free-shipping-israel-checker", arguments: [{ name: "orderMinimum", value: "20000" }] }
  calculator: { code: "default-shipping-calculator", arguments: [
      { name: "rate", value: "0" }, { name: "includesTax", value: "auto" }, { name: "taxRate", value: "0" }
  ] }
  translations: [{ languageCode: en, name: "Free Shipping", description: "" }]
})
```

`fulfillmentHandler: "manual-fulfillment"` matches what the two existing shipping methods already use (confirmed in the seeded `shipping_method` rows) — no new fulfillment handler needed.

## Files to Create/Modify

- **Create**: `src/shipping-methods/free-shipping-israel-checker.ts` — mirrors the project's existing convention of isolating custom config objects under `src/<domain>-methods/` (see `src/payment-methods/apple-pay-simulated-handler.ts`).
- **Modify**: `src/vendure-config.ts` — add the `shippingOptions` block, import `defaultShippingEligibilityChecker`/`defaultShippingCalculator` from `@vendure/core` and the new checker from the new file.
- **No entity/migration file** — checker/calculator config lives in `ShippingMethod`'s existing generic `ConfigurableOperation` JSON columns, already present on the entity. This feature needs no schema change.

## Registration/Configuration Needed

The `vendure-config.ts` change above is the only registration step. The actual `ShippingMethod` row must then be created (via the Admin API mutation shown, or an equivalent one-off script) — this is data, not code, but is required for the feature to be observable; the Developer stage should create it as part of delivering this feature, the same way `variant-internal-note`'s Developer stage ran its own migration rather than leaving it for someone else.

## Frontend/Storefront Implications

None requiring new code — the Shop API's existing `eligibleShippingMethods` query will simply include "Free Shipping" in its results once eligible, exactly like any other shipping method. No storefront exists in this repo to update (a pre-existing, separate gap).

## Tests to Add

Given this project has no test framework (same pre-existing gap as before), the Developer stage should verify with the same manual-but-real approach used for `variant-internal-note`:
1. Query `eligibleShippingMethods` (Shop API) for a draft/active order with shipping address country `IL` and subtotal ≥ 20000 → confirm "Free Shipping" appears with price 0.
2. Same but subtotal below 20000, or country other than `IL` → confirm it does **not** appear.
3. **Explicitly re-check `standard-shipping` and `express-shipping` still appear, unconditionally, at their original prices (500/1000)** — this is Story 3 and the single most important regression check given the array-replacement risk identified above.

## Risks

- **The array-replacement risk is the primary risk of this entire feature.** Mitigated by design (explicitly including the defaults in the new arrays), but the Developer stage must not "simplify" that away, and the Reviewer must explicitly re-verify it live rather than trust the config reads correctly on paper.
- **Minor-units confusion**: `20000` looks like a typo for `200` to an unfamiliar reader. The code comment and this document both call it out explicitly to prevent someone "fixing" it to `200` later.
- **Low risk otherwise**: no schema change, no new API surface, reuses an existing fulfillment handler.

## Rejected Alternatives

- **A dedicated new `ShippingCalculator` that always returns price 0**, instead of reusing `defaultShippingCalculator` with `rate: 0`. Rejected: adds a file and a code path for something the existing calculator already does via its `rate` argument — exactly the kind of unnecessary parallel mechanism this pipeline's skills are meant to avoid.
- **Replacing `standard-shipping`/`express-shipping`'s checker configuration instead of adding a new method.** Rejected outright: the business requirement explicitly says existing shipping options must be untouched, and this would violate that directly, not just risk it.
- **Hardcoding the threshold instead of exposing it as a configurable `orderMinimum` arg.** Rejected: the existing `defaultShippingEligibilityChecker` pattern already exposes this as a configurable arg, and keeping it configurable costs nothing while making a future threshold change (explicitly anticipated in the business requirement) a config change instead of a code change.
