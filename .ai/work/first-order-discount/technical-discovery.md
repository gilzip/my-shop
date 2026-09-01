# Technical Discovery

## Business Requirement Summary

An automatic (no coupon code) 10% discount on a customer's first order only — including guest checkouts, where "the same person" is recognized by email across visits, even without an account.

## Existing Capability

This project has no custom Promotions configuration — it runs on Vendure's default promotion actions/conditions, registered automatically (`defaultPromotionActions`/`defaultPromotionConditions` in `@vendure/core`'s own config, not anything this project added).

## Existing Architecture Relevant to This Feature's Domain

Three of the four pieces this feature needs already exist, confirmed against the installed `@vendure/core`:

1. **Whole-order percentage discount**: `orderPercentageDiscount` (code `order_percentage_discount`) is a built-in, already-registered `PromotionOrderAction`. `execute()` computes `-orderTotal * (args.discount / 100)` against `order.subTotal`/`subTotalWithTax` — the entire order, exactly as required. No custom action needed.
2. **Coupon-code-free (automatic) promotions**: `CreatePromotionInput.couponCode` is optional (`couponCode?: InputMaybe<...>`). A Promotion created with no coupon code applies automatically to every eligible order — nothing for the customer to enter.
3. **Guest identity across visits**: `CustomerService.createOrUpdate` — used by the default `GuestCheckoutStrategy` — looks up an existing `Customer` by normalized email address and reuses that same `Customer.id` rather than creating a new one. A guest who orders twice with the same email is, from the system's point of view, the same `Customer` both times. This directly satisfies the business's "same guest across visits" requirement without any new identity logic.

**The one piece that does not already exist**: a condition expressing "this is the customer's first order." Vendure's five built-in `PromotionCondition`s (`minimum_order_amount`, `has_facet_values`, `contains_products`, `customer_group`, `buy_x_get_y_free_condition` — confirmed exhaustively from `defaultPromotionConditions`) cover order total, facets, products, customer group, and buy-X-get-Y. None reference order count or order history. **This requires one small custom `PromotionCondition`.**

## Similar Implementations

The shipped `customer_group` condition (`customer-group-condition.js`) is the direct pattern to follow for the new condition — it's the one built-in condition that already does an async, service-backed lookup (via `init(injector)` capturing a service, then using it inside `check()`) rather than only inspecting the `order` object passed in. The new condition should follow that same shape, injecting `OrderService` to call `findByCustomerId` instead of `CustomerService` to call `getCustomerGroups`.

## Existing Business Rules Encoded in the System

- A `Promotion`'s conditions all must pass for its actions to apply — this is existing, generic promotion evaluation logic; the new condition just needs to return `true`/`false` correctly and the rest of the "must all pass" behavior comes free.
- `CustomerService.createOrUpdate`'s email-matching behavior for guest identity is already the system's standing rule for "is this the same person," not something this feature invents — reusing it means this feature's definition of "the same guest" is consistent with how the rest of the system already treats guest identity.

## Relevant Tests

None exist in this project (same pre-existing, documented gap as the prior two features).

## Reuse Opportunities

- Full reuse of `order_percentage_discount` (the action).
- Full reuse of the coupon-code-optional mechanism (no new API/schema needed for "automatic").
- Full reuse of `CustomerService`'s existing guest-identity-by-email behavior.
- Pattern reuse (not code reuse — the query differs) of the `customer_group` condition's injector-based service-access shape.

## Required Changes

1. One new custom `PromotionCondition` (e.g. code `is_first_order`) that, given `order.customer`, uses an injected `OrderService` to check whether any other placed order already exists for that `customer.id` (excluding the order currently being evaluated), returning `true` only if none does.
2. Register the new condition in `vendure-config.ts`'s `promotionOptions.promotionConditions` — and, per the array-replacement lesson learned in `free-shipping-israel`, that array must include the framework's `defaultPromotionConditions`, not just the new one, or the existing five built-in conditions would stop working project-wide.
3. Create one new `Promotion` (via the existing `createPromotion` Admin API mutation — already available, no new API surface) with: no coupon code, the new `is_first_order` condition, and the existing `order_percentage_discount` action at `discount: 10`.

## New Business Behavior

The "first order ever, including guests, keyed by email" rule is the one genuinely new piece of logic — everything else is existing framework behavior being configured, not extended.

## Relevant Files

- `src/vendure-config.ts` — add `promotionOptions.promotionConditions` (must include the defaults).
- A new file for the custom condition (e.g. `src/promotions/is-first-order-condition.ts`), following the project's established convention (`src/payment-methods/`, `src/shipping-methods/`) of isolating custom config objects by domain.
- No entity/migration change anticipated — Promotion conditions/actions are stored in the same generic `ConfigurableOperation` JSON columns already on the `Promotion` entity (same pattern as `ShippingMethod`'s checker/calculator columns confirmed in the previous feature).

## Evidence from Source

- `node_modules/@vendure/core/dist/config/promotion/actions/order-percentage-discount-action.js`
- `node_modules/@vendure/core/dist/config/promotion/index.js` (`defaultPromotionActions`/`defaultPromotionConditions` arrays)
- `node_modules/@vendure/core/dist/config/promotion/conditions/customer-group-condition.js` (pattern reference)
- `node_modules/@vendure/common/lib/generated-types.d.ts` (`CreatePromotionInput.couponCode?`)
- `node_modules/@vendure/core/dist/config/order/default-guest-checkout-strategy.js` and `dist/service/services/customer.service.js` (`createOrUpdate`'s email-matching JSDoc: *"For guest checkouts, we assume that a matching email address is the same customer."*)
- `node_modules/@vendure/core/dist/service/services/order.service.d.ts` (`findByCustomerId`)
- `node_modules/@vendure/core/dist/config/promotion/promotion-condition.d.ts` and `dist/common/injector.d.ts` (condition signature, `init(injector)` pattern)

## Open Questions

None blocking. One definition to make explicit for the Architect: "has ordered before" should mean an order that reached a genuinely placed state (not an abandoned/in-progress cart) — the Architect should confirm exactly which `OrderState`(s)/`active` flag combination counts as "placed" against the real `OrderService` API, rather than this document guessing the precise state name.
