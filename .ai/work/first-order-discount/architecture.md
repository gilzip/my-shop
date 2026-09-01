# Architecture: Automatic 10% Discount on a Customer's First Order

## Verified Architecture

Independently re-confirmed every load-bearing claim from `technical-discovery.md`:

1. **`order_percentage_discount` exists and discounts the whole order.** `node_modules/@vendure/core/dist/config/promotion/actions/order-percentage-discount-action.js` — confirmed the exact code and `execute()` computing against `order.subTotal`/`subTotalWithTax`.
2. **`CreatePromotionInput.couponCode` is optional** — confirmed in `@vendure/common/lib/generated-types.d.ts`, matching discovery's claim exactly.
3. **Guest identity by email is real, existing behavior**, not something to build — `CustomerService.createOrUpdate`'s own JSDoc: *"For guest checkouts, we assume that a matching email address is the same customer."* Confirmed it looks up by normalized email and reuses the existing `Customer` row rather than creating a duplicate.
4. **No built-in "first order" condition exists** — confirmed `defaultPromotionConditions` is exactly the five discovery named; none reference order history.
5. **The "genuinely placed" signal, determined independently rather than guessed**: `Order.orderPlacedAt` (`node_modules/@vendure/core/dist/entity/order/order.entity.d.ts:56`) — *"The date & time that the Order was placed, i.e. the Customer completed the checkout and the Order is no longer 'active'."* This is a cleaner, more direct signal than combining `state`/`active` checks: **`orderPlacedAt` being non-null is exactly "genuinely placed," and null is exactly "not yet placed / abandoned."** This satisfies Story 2's edge case directly.

No claim needed correction.

## Design Principle Applied

The smallest possible extension: one new `PromotionCondition`, reusing the existing `order_percentage_discount` action and the coupon-free mechanism entirely as-is. No new action, no new entity, no change to guest-identity logic.

## Proposed Design

**1. New condition file** `src/promotions/is-first-order-condition.ts`, following the `customer_group` condition's `init(injector)` pattern:

```ts
import { Injector, LanguageCode, Order, OrderService, PromotionCondition } from '@vendure/core';

let orderService: OrderService;

export const isFirstOrderCondition = new PromotionCondition({
    code: 'is_first_order',
    description: [{ languageCode: LanguageCode.en, value: "Applies only to the customer's first placed order" }],
    args: {},
    async init(injector: Injector) {
        orderService = injector.get(OrderService);
    },
    async check(ctx, order: Order) {
        if (!order.customer) {
            return false;
        }
        const priorOrders = await orderService.findByCustomerId(ctx, order.customer.id);
        const hasAnyOtherPlacedOrder = priorOrders.items.some(
            o => o.id !== order.id && o.orderPlacedAt != null,
        );
        return !hasAnyOtherPlacedOrder;
    },
});
```

Checking `orderPlacedAt != null` on each returned order (rather than trusting `findByCustomerId` to pre-filter) is deliberate: it directly satisfies Story 2's "abandoned cart doesn't count" edge case using the exact field discovery/architecture identified for that purpose, rather than relying on an assumption about what `findByCustomerId` returns by default.

**2. `vendure-config.ts` change** — mirroring exactly the lesson from `free-shipping-israel`:

```ts
promotionOptions: {
    promotionConditions: [...defaultPromotionConditions, isFirstOrderCondition],
    // promotionActions left unset - order_percentage_discount is already
    // registered by the framework default, no override needed.
},
```

Using `[...defaultPromotionConditions, isFirstOrderCondition]` (spreading the actual default array) rather than manually re-listing the five conditions by name - this is safer than the shipping feature's approach, since it can't silently go stale if a future Vendure upgrade adds a sixth built-in condition. `promotionActions` doesn't need to be touched at all, since `order_percentage_discount` is already in the default and no new action is being added.

**3. New `Promotion`** — created via the existing `createPromotion` Admin API mutation (already available, no new API surface):

```graphql
createPromotion(input: {
  enabled: true
  couponCode: null
  conditions: [{ code: "is_first_order", arguments: [] }]
  actions: [{ code: "order_percentage_discount", arguments: [{ name: "discount", value: "10" }] }]
  translations: [{ languageCode: en, name: "First Order 10% Off", description: "" }]
})
```

## Files to Create/Modify

- **Create**: `src/promotions/is-first-order-condition.ts`.
- **Modify**: `src/vendure-config.ts` — add `promotionOptions.promotionConditions` using the array-spread pattern above, and import `defaultPromotionConditions`/`OrderService`/`Injector` as needed from `@vendure/core`.
- **No entity/migration file** — condition/action config lives in `Promotion`'s existing generic config columns.

## Registration/Configuration Needed

The `vendure-config.ts` change is the only registration step. The `Promotion` row itself is data (created via the Admin API mutation shown), the same pattern as `free-shipping-israel`'s new `ShippingMethod` row.

## Frontend/Storefront Implications

None requiring new code - the Shop API's existing order/pricing responses will simply reflect the discount once the condition is satisfied, exactly like any other promotion. No storefront exists in this repo (pre-existing, unrelated gap).

## Tests to Add

Same manual-but-real approach as the prior two features, given no test framework exists:
1. A fresh guest session's first order (email X, discount-eligible) → confirm the order total reflects the 10% discount with no coupon code entered.
2. A second order from the same email (X) → confirm no discount.
3. **Explicitly re-verify Vendure's five built-in promotion conditions still work** (e.g. `minimum_order_amount` on some other existing/test promotion, if one can be exercised) - this is Story 4, and the direct analog of the shipping feature's most important regression check.

## Risks

- **Array-replacement risk again** - mitigated by spreading `defaultPromotionConditions` rather than hand-listing them, which is actually a slightly more robust mitigation than the shipping feature used (that one hand-listed the one default it needed; this one spreads the whole default array since there are five to preserve, not one).
- **`orderPlacedAt` correctness depends on `OrderPlacedStrategy`** - this project doesn't override that strategy, so the framework default behavior applies; if a future feature ever customizes `OrderPlacedStrategy`, this condition's correctness assumption should be re-checked.
- **Low risk otherwise**: no schema change, no new API surface, reuses an existing action and the existing guest-identity mechanism untouched.

## Rejected Alternatives

- **A `customerGroup`-based approach** (e.g. auto-assign new customers to a "first-time" group, then use the existing `customer_group` condition). Rejected: this would require new logic to manage group membership lifecycle (adding on signup, removing after first order) - genuinely more moving parts than one condition that reads order history directly, and introduces a new failure mode (group membership drifting out of sync with actual order history).
- **A coupon-code promotion, auto-applied by the storefront on first visit.** Rejected outright by the business requirement itself - the discount must not depend on any code being entered or auto-injected, since that reintroduces the "anyone who sees the code can reuse it" risk the requirement explicitly rules out.
- **Checking `order.customer.orders.length` directly on the entity relation instead of calling `OrderService.findByCustomerId`.** Rejected: `technical-discovery.md`/this document couldn't confirm that relation is reliably eager-loaded on the `Order` passed into a condition's `check()`, whereas `OrderService.findByCustomerId` is the confirmed, documented service method for this exact lookup - going through the service is the safer, more explicit choice.
