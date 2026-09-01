# Technical Discovery

## Business Requirement Summary

A reusable "buy product X, get product Y at a discount" promotion capability, configurable per product pair and discount amount by staff, with the discount scaling per unit of Y (every qualifying unit discounted, not just one).

## Existing Capability

Vendure ships a built-in `buy_x_get_y_free` condition and a paired `buyXGetYFreeAction` - both confirmed exhaustively present in `defaultPromotionConditions`/`defaultPromotionActions`. This is the closest existing mechanism, but it is hardcoded to 100% off, not a configurable discount percentage - confirmed by reading `buyXGetYFreeAction`'s `args: {}` (empty) directly.

## Existing Architecture Relevant to This Feature's Domain

The key architectural finding: **the condition and the action are two separate, independently reusable pieces, linked by a hardcoded `conditions: [buyXGetYFreeCondition]` declaration on the action, not by the condition itself.** This is important because it means the existing condition can be reused completely as-is, paired with a *new* action, rather than needing to modify or reimplement the condition's own quantity-matching logic.

`buyXGetYFreeCondition`'s `check()` does the real work already: it matches order lines against configurable `variantIdsX`/`variantIdsY` argument lists, computes how many "buy" multiples of `amountX` occurred, and allocates up to `amountY` free units across the cheapest matching Y lines - storing the result as a `freeItemsPerLine` map (order line id → qualifying quantity) in shared condition `state`, which any paired action can read via `state.buy_x_get_y_free.freeItemsPerLine`.

**A second architectural finding, specific to Story requirement (per-unit scaling)**: per-unit discount scaling is not something any action needs to implement itself - it's a property of the framework. `Promotion.apply()` (the entity method that invokes actions) multiplies every `PromotionItemAction`'s per-unit return value by `orderLine.quantity` via `roundMoney(amount, orderLine.quantity)`. `buyXGetYFreeAction` exploits this by dividing `freeQuantity / orderLine.quantity` inside its own `execute()`, so the framework's later multiplication by the full line quantity cancels back out to exactly `-unitPrice * freeQuantity` - i.e., only the qualifying (capped) quantity gets discounted, scaled correctly, with no manual loop. A new discount action for this feature should use the identical pattern.

**No existing action supports both "specific configurable discount %" and "quantity-capped by a buy-X condition" together.** `productsPercentageDiscount` (a different built-in action) does support a configurable percentage discount on specific products, but it declares no `conditions` link at all - it would discount *every* matching Y unit in the order unconditionally (once the overall Promotion's conditions pass), not just the `amountY`-capped quantity the business requirement (and the "buy X get Y" shape generally) implies. Pairing it with `buyXGetYFreeCondition` on the same Promotion wouldn't connect them - `Promotion.test()` only ANDs whether conditions pass, it doesn't feed condition-computed quantities into unrelated actions.

## Similar Implementations

`buyXGetYFreeAction` (`dist/config/promotion/actions/buy-x-get-y-free-action.js`) is the exact structural template: same `conditions: [buyXGetYFreeCondition]` linkage, same `state.buy_x_get_y_free.freeItemsPerLine` read, same per-unit-scaling division pattern - just returning `-unitPrice` (100% off) instead of a configurable fraction.

## Existing Business Rules Encoded in the System

The existing condition already encodes "buy X get Y" quantity-capping logic (allocating discount to only up to `amountY` units, preferring the cheapest matching lines) - this feature should reuse that logic exactly as-is via the shared condition, not reinvent a different capping rule.

## Relevant Tests

None available (same pre-existing gap as prior features; installed package ships compiled `dist` only).

## Reuse Opportunities

- **Full reuse** of `buyXGetYFreeCondition` - already supports configurable X/Y product pairs and quantities per Promotion instance, exactly matching the business requirement's "staff can configure the pair" rule. No changes needed.
- **Pattern reuse** (not code reuse) of `buyXGetYFreeAction`'s per-unit-scaling technique for the new action.
- **Full reuse** of the framework's automatic per-unit multiplication (`roundMoney(..., orderLine.quantity)`) - this is exactly what makes the business's "scales per unit" decision achievable without new scaling logic.

## Required Changes

1. One new custom `PromotionItemAction` (not a new condition) that: declares `conditions: [buyXGetYFreeCondition]` (reusing the existing condition unchanged), adds a configurable `discountPercentage` arg (staff-configurable per Promotion, same shape as `productsPercentageDiscount`'s `discount` arg), reads `state.buy_x_get_y_free.freeItemsPerLine[orderLine.id]` for the qualifying quantity, and returns a partial (not 100%) discount using the same scaling-cancellation technique as `buyXGetYFreeAction`.
2. Register the new action in `vendure-config.ts`'s `promotionOptions.promotionActions` (a new config key for this project - no prior feature has touched `promotionActions`, only `promotionConditions`), including the existing `defaultPromotionActions` alongside it per the now-familiar array-replacement risk.

## New Business Behavior

The "at a configurable discount, not free" behavior is the one genuinely new piece - everything else (the buy-X-get-Y quantity logic, the per-unit scaling, the per-Promotion configurability of the product pair) already exists and is reused unchanged.

## Relevant Files

- A new file for the custom action (e.g. `src/promotions/buy-x-get-y-discount-action.ts`), following the project's established convention (`src/payment-methods/`, `src/shipping-methods/`, `src/promotions/is-first-order-condition.ts`).
- `src/vendure-config.ts` - add `promotionOptions.promotionActions`.
- No entity/migration change anticipated - same generic `Promotion.actions`/`conditions` JSON columns as `first-order-discount` used.

## Evidence from Source

- `node_modules/@vendure/core/dist/config/promotion/conditions/buy-x-get-y-free-condition.js` - the reusable condition, its `args` shape, and `freeItemsPerLine` allocation logic.
- `node_modules/@vendure/core/dist/config/promotion/actions/buy-x-get-y-free-action.js` - the paired action, confirming `args: {}` (no discount-percentage support) and the per-unit-scaling division pattern.
- `node_modules/@vendure/core/dist/config/promotion/actions/product-percentage-discount-action.js` - confirms a configurable-percentage action exists but with no `conditions` link (why it can't just be paired as-is).
- `node_modules/@vendure/core/dist/config/promotion/index.js` - the complete, exhaustive `defaultPromotionActions`/`defaultPromotionConditions` lists.
- `node_modules/@vendure/core/dist/entity/promotion/promotion.entity.js` - `Promotion.apply()`'s `roundMoney(amount, orderLine.quantity)` call, confirming per-unit scaling is a framework property, not action-specific logic.
- `node_modules/@vendure/core/dist/config/entity/default-money-strategy.js` - `round(value, quantity)`'s multiplication.

## Open Questions

None blocking. One thing to make explicit for the Architect rather than leave implicit: the new action's discount fraction should apply to the same *qualifying, capped* quantity the existing condition already computes (`freeItemsPerLine`), not to every unit of Y in the order regardless of the buy-X quantity relationship - this is what makes it a true "buy X get Y" promotion rather than an unconditional percentage-off-Y promotion that merely requires X to also be present.
