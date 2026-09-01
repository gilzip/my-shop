# Epic: Automatic 10% Discount on a Customer's First Order

## Summary

Add an automatic (no coupon code) 10% discount that applies only to a customer's genuinely first order — including guest checkouts recognized by email — using Vendure's existing Promotions extension model. Nearly the entire feature reuses framework behavior already in place; the only new piece is a small custom `PromotionCondition` for "is this the customer's first order."

## Why now

This is the third of three small features run through the DevSDLC pipeline specifically to validate it across different Vendure modules — the first (`variant-internal-note`) exercised Catalog/customFields, the second (`free-shipping-israel`) exercised Shipping with no schema change. This one exercises Promotions, and is specifically expected to be *mostly* framework reuse with one small custom piece — a useful check that the pipeline doesn't manufacture unnecessary new code when the framework already covers most of a request, while still correctly identifying the one genuinely new piece rather than assuming everything is already covered.

## What "done" looks like in the context of this product

- A new `Promotion` (no coupon code) exists, gated by a new `is_first_order` condition and applying the existing `order_percentage_discount` action at 10%.
- A genuinely new customer's (or new guest's, by email) first order is discounted 10%; their second order onward is not.
- No new database table or column — condition/action config lives in `Promotion`'s existing generic config columns.

## In Scope

- One new `PromotionCondition` (`is_first_order`) checking, per customer, whether any other placed order already exists.
- Registration of the new condition alongside Vendure's default promotion conditions in `vendure-config.ts`.
- Creation of the new `Promotion`, using the existing built-in `order_percentage_discount` action.

## Out of Scope

- Any coupon-code version of this discount.
- Discounts for any other segment (referrals, repeat customers, etc.).
- Any campaign start/end date — this is a standing rule.
- Changing how guest identity/email-matching works generally — this feature only consumes that existing behavior, it doesn't change it.

## Dependencies

None on other in-flight work.
