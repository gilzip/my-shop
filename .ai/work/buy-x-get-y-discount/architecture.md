# Architecture: Buy X, Get Y at a Discount

## Verified Architecture

Independently re-confirmed the exact linkage pattern in `buy-x-get-y-free-action.js`:
```js
args: {},
conditions: [buy_x_get_y_free_condition_1.buyXGetYFreeCondition],
execute(ctx, orderLine, args, state) {
    const freeItemsPerLine = state.buy_x_get_y_free.freeItemsPerLine;
    const freeQuantity = freeItemsPerLine[orderLine.id];
    if (freeQuantity) {
        const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
        return -unitPrice * (freeQuantity / orderLine.quantity);
    }
    return 0;
}
```
Confirms: (1) `args: {}` - no discount-percentage support exists today; (2) the `conditions` array is exactly how an action reads a condition's computed state, keyed by the condition's own code (`buy_x_get_y_free`); (3) the `freeQuantity / orderLine.quantity` division is what makes the framework's later per-unit multiplication (`roundMoney(amount, orderLine.quantity)` in `Promotion.apply()`) land on the correct total rather than over- or under-discounting.

No claim from discovery needed correction.

## Design Principle Applied

Reuse the existing condition completely unchanged; write the smallest possible new action - one that differs from the existing `buyXGetYFreeAction` only by multiplying in a configurable fraction instead of always fully discounting.

## Proposed Design

**New file** `src/promotions/buy-x-get-y-discount-action.ts`:

```ts
import { LanguageCode, PromotionItemAction } from '@vendure/core';
import { buyXGetYFreeCondition } from '@vendure/core/dist/config/promotion/conditions/buy-x-get-y-free-condition';
// Note: exact import path for the condition to be confirmed by the Developer stage against
// what @vendure/core actually exports from its public index - see Risks below.

export const buyXGetYDiscountAction = new PromotionItemAction({
    code: 'buy_x_get_y_discount',
    description: [{ languageCode: LanguageCode.en, value: 'Discount the qualifying units of Y by { discountPercentage }%' }],
    args: {
        discountPercentage: {
            type: 'float',
            ui: { component: 'number-form-input', suffix: '%', min: 0, max: 100 },
            label: [{ languageCode: LanguageCode.en, value: 'Discount percentage on qualifying Y units' }],
        },
    },
    conditions: [buyXGetYFreeCondition],
    execute(ctx, orderLine, args, state) {
        const freeItemsPerLine = state.buy_x_get_y_free.freeItemsPerLine;
        const qualifyingQuantity = freeItemsPerLine[orderLine.id];
        if (qualifyingQuantity) {
            const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
            return -unitPrice * (args.discountPercentage / 100) * (qualifyingQuantity / orderLine.quantity);
        }
        return 0;
    },
});
```

This is deliberately almost line-for-line `buyXGetYFreeAction`, with exactly one change: the return value is scaled by `args.discountPercentage / 100` instead of being a full `-unitPrice`. The `conditions: [buyXGetYFreeCondition]` linkage means this new action **only ever applies to a Promotion that also has `buyXGetYFreeCondition` as one of its conditions** - it cannot be misconfigured onto a Promotion without that condition and silently do nothing useful; Vendure's promotion configuration UI/validation ties actions to their declared condition dependencies.

**`vendure-config.ts` change**, following the same array-spread safety pattern established for `promotionConditions`:
```ts
promotionOptions: {
    promotionConditions: [...defaultPromotionConditions, isFirstOrderCondition],
    promotionActions: [...defaultPromotionActions, buyXGetYDiscountAction],
},
```

**Staff configure a new Promotion** (via the existing `createPromotion` mutation - no new API surface) with `buyXGetYFreeCondition` (their chosen X/Y variant ids and quantities) plus this new action (their chosen discount percentage) - both already fully configurable per Promotion instance, satisfying Story 3 with zero new configuration mechanism.

## Files to Create/Modify

- **Create**: `src/promotions/buy-x-get-y-discount-action.ts`.
- **Modify**: `src/vendure-config.ts` - add `promotionOptions.promotionActions` alongside the existing `promotionConditions`.
- **No entity/migration change** - same generic `Promotion` config columns as `first-order-discount`.

## Registration/Configuration Needed

Only the `vendure-config.ts` change above. The actual Promotion instance (with its specific product pair and discount %) is data, created the same way `first-order-discount`'s promotion was.

## Frontend/Storefront Implications

None requiring new code - the Shop API's existing order/pricing responses reflect the discount automatically, same as every prior promotion feature. No storefront exists in this repo.

## Tests to Add

Same manual-but-real approach as prior features:
1. An order with the qualifying X quantity and multiple qualifying Y units → confirm the discount equals the configured percentage times the qualifying (capped) quantity, not the full Y quantity in the order.
2. An order with Y but not enough X to qualify → confirm no discount on Y.
3. **Explicitly re-verify `buyXGetYFreeAction` and the other five default actions still work** - Story 4, and the direct analog of every prior feature's most important regression check.
4. A second promotion configured with a different product pair/discount % → confirm it behaves independently and correctly (Story 3).

## Risks

- **Import path for `buyXGetYFreeCondition`**: the sketch above imports it from a deep internal path (`@vendure/core/dist/config/promotion/conditions/...`) because it's unclear from architecture-stage inspection alone whether `@vendure/core`'s public package entry point (`dist/index.js`) re-exports this specific condition object for external reuse, the way it does for broadly-used exports like `defaultShippingCalculator`. **The Developer stage must verify this import resolves from the public package entry point** before writing the file this way; if it doesn't, the fallback is trivial (re-implement the same `check()` logic in a new condition file reusing the same `code: 'buy_x_get_y_free'` string so the state key still matches) but that would mean not fully reusing existing code, which should be flagged back to this document if it turns out to be necessary.
- **Coupling to the condition's internal state shape** (`state.buy_x_get_y_free.freeItemsPerLine`) means this action would silently stop working if a future Vendure upgrade changes that internal shape - an accepted risk here since `buyXGetYFreeAction` (Vendure's own code) has the identical coupling, so this feature is no more fragile than the framework's own equivalent feature.
- **Low risk otherwise**: no schema change, no new API surface, action structure mirrors an existing, working action almost exactly.

## Rejected Alternatives

- **Modifying `buyXGetYFreeCondition` or `buyXGetYFreeAction` directly.** Rejected - these are framework code, not this project's; modifying vendored/`node_modules` code is never appropriate, and would be lost on any dependency update regardless.
- **Using `productsPercentageDiscount` (the existing configurable-percentage action) instead of writing a new action.** Rejected per discovery's finding: it has no `conditions` link, so it would discount every matching Y unit unconditionally rather than only the buy-X-qualified, quantity-capped units - not the same promotion shape the business asked for.
- **A single combined custom condition+action pair, reimplementing the X/Y matching logic from scratch instead of reusing `buyXGetYFreeCondition`.** Rejected - `buyXGetYFreeCondition` already correctly implements exactly this matching/capping logic; reimplementing it would duplicate real logic (with real chances of behavioral drift from the existing, framework-tested version) for no benefit.
