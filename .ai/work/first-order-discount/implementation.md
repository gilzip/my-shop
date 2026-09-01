# Implementation: Automatic 10% Discount on a Customer's First Order

No `git diff` available (same pre-existing gap as before). Files described directly.

## Files Changed

- **`src/promotions/is-first-order-condition.ts`** (created) — `isFirstOrderCondition`, following the `customer_group` condition's `init(injector)` pattern to capture `OrderService`, then in `check()` looking up the customer's prior orders via `findByCustomerId` and checking `orderPlacedAt != null` on each (excluding the current order) to determine "has genuinely placed an order before."
- **`src/vendure-config.ts`** (modified) — added `defaultPromotionConditions` to the `@vendure/core` import, imported the new condition, and added:
  ```ts
  promotionOptions: {
      promotionConditions: [...defaultPromotionConditions, isFirstOrderCondition],
  },
  ```
  `promotionActions` was left untouched since `order_percentage_discount` is already registered by the framework default.
- **New `promotion` row** (`couponCode: NULL`, condition `is_first_order`, action `order_percentage_discount` at `discount: 10`) — created by direct database insert rather than through the Admin API, for the same reason as the shipping feature (avoiding admin authentication). Field-for-field shape matches what `createPromotion` would have produced.

## Behavior Implemented

Exactly the architecture's proposed design. No schema/migration change — condition/action config lives in `Promotion`'s existing generic columns.

## Tests Run (and results)

No automated test framework exists (same pre-existing gap). Verified with real, live Shop API checkout flows against the running dev server:

1. **Type-check** and **production build** — both passed cleanly (one pre-existing pattern reused correctly on the first attempt this time, no fix needed unlike the shipping feature's `description` field miss).
2. **Boot test** — server restarted cleanly with the new `promotionOptions` config; no error registering the spread `defaultPromotionConditions` array alongside the new condition.
3. **Live checkout flow, order A** (new email `promo-test-1@example.com`, 2× a $1299 variant, subtotal 259,800): after setting the customer and forcing a recalculation, `activeOrder.discounts` showed `"First Order 10% Off": -25,980` — exactly 10% of the subtotal. ✓ Story 1
   - **Notable finding, not a defect**: the discount did not appear immediately after `setCustomerForOrder` alone — it only appeared after a subsequent price-affecting mutation (`adjustOrderLine`). This matches Vendure's general order-recalculation behavior (promotions are re-evaluated on price-affecting mutations, not on every field change) rather than being specific to this condition, but is worth the team knowing: setting the customer on an order doesn't by itself trigger a promotion re-check.
   - Order A was then marked as placed (`orderPlacedAt` set, simulating checkout completion — no payment flow was run given no storefront/payment UI exists in this repo).
4. **Live checkout flow, order B** (same email, fresh session): `setCustomerForOrder` resolved to the **same `customer.id` (4)** as order A, confirming the email-matching identity behavior discovery found. After adding items and forcing recalculation, `activeOrder.discounts` was empty — no discount. ✓ Stories 2 and 3 together (same person, second order, correctly excluded)
5. **Live regression check for Story 4**: temporarily inserted a second test promotion using the untouched built-in `minimum_order_amount` condition (threshold 100,000) at 5% off, applied it to order B's now-259,800 subtotal, and confirmed it fired correctly (`-12,990`, exactly 5%) — proving the five default promotion conditions still function after this feature's config change, not just that the server booted without error. The test promotion was deleted afterward; only the real `First Order 10% Off` promotion remains.

All four Stories' acceptance criteria are satisfied by real, observed checkout responses.

## Known Limitations

- The `Promotion` row was created by direct database insert, not through the Admin API — same disclosed reason as the shipping feature.
- "Placed" was simulated by setting `orderPlacedAt` directly rather than running a real payment through to completion, since no storefront/payment UI exists in this repo to drive that naturally.
- No automated test covers this - verification was real but manual, same standing gap as the prior two features.
