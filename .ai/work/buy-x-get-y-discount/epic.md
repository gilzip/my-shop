# Epic: Buy X, Get Y at a Discount

## Summary

Add one new `PromotionItemAction` that pairs with Vendure's existing, fully-reusable `buyXGetYFreeCondition` to apply a *configurable* discount percentage (not the built-in action's hardcoded 100% off) to the qualifying, quantity-capped units of product Y, scaling correctly per unit via the framework's existing per-unit rounding mechanism.

## Why now

Discovery found this sits precisely between "fully achievable via config" (the previous `first-order-discount` and `free-shipping-israel` features, which needed one small custom condition/checker) and "needs substantial new logic" - here, the *condition* is entirely reusable as-is, and only the *action* needs a small, tightly-scoped custom implementation, mirroring an existing built-in action's own pattern almost exactly.

## What "done" looks like in the context of this product

- Staff can create a Promotion with `buyXGetYFreeCondition` (existing, unchanged) configured for any product pair/quantities, paired with the new discount action configured with any percentage.
- A customer with both qualifying products in their order sees Y discounted by the configured percentage, only for the quantity of Y the condition's own capping logic already allocates (not every unit of Y unconditionally).
- The discount scales correctly per unit, using the framework's existing per-unit multiplication - no new scaling logic needed.
- The existing `buyXGetYFreeAction` (100%-off) and all other built-in promotion actions continue to work exactly as before.

## In Scope

- One new custom `PromotionItemAction`, reusing the existing `buyXGetYFreeCondition`.
- Registration of the new action alongside Vendure's default promotion actions in `vendure-config.ts`.

## Out of Scope

- Any change to `buyXGetYFreeCondition` or `buyXGetYFreeAction` themselves.
- Any UI for staff to configure promotions - assumed to already exist via the Dashboard's generic ConfigurableOperation form rendering (the same mechanism every other promotion/shipping/customField config already renders through).
- Automatically adding Y to the customer's cart.

## Dependencies

None on other in-flight work.
