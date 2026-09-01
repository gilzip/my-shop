# Epic: Free Shipping for Israel Orders Over 200 ILS

## Summary

Add a new shipping method, eligible only when the order ships to Israel and its subtotal reaches 200 ILS (20000 in the system's minor-unit representation), using Vendure's existing `ShippingEligibilityChecker`/`ShippingCalculator` extension model. The existing `standard-shipping` and `express-shipping` methods must continue to behave exactly as they do today.

## Why now

This is the second of three small features run through the DevSDLC pipeline specifically to validate it across different Vendure modules — the first (`variant-internal-note`) exercised Catalog/customFields; this one exercises Shipping, and is expected to need no database schema change at all (unlike the first), so it should also validate that the DBA stage correctly recognizes that and skips itself.

## What "done" looks like in the context of this product

- A new `ShippingMethod` ("Free Shipping") exists, eligible only for orders where `shippingAddress.countryCode === 'IL'` and `subTotalWithTax >= 20000`.
- `standard-shipping` and `express-shipping` remain unconditionally eligible with their existing flat rates — verified explicitly, not assumed, given the discovered `mergeConfig` array-replacement risk.
- No new database table or column — checker/calculator config lives in `ShippingMethod`'s existing generic config columns.

## In Scope

- One new `ShippingEligibilityChecker` (destination + subtotal condition).
- Reuse of `defaultShippingCalculator` at `rate: 0` for the free-shipping price.
- Registration of both the new checker and the pre-existing default checker/calculator in `vendure-config.ts`'s `shippingOptions`.
- Creation of the new `ShippingMethod` itself.

## Out of Scope

- Any other country or region qualifying for free shipping.
- Any other eligibility condition (product-specific, customer-tier-specific, promotional-code-specific).
- Any change to `standard-shipping` or `express-shipping`'s own configuration.
- Time-limited/campaign behavior (start/end dates) — this is a standing rule.

## Dependencies

None on other in-flight work. This feature is a useful precedent for future "conditional shipping option" work, but doesn't depend on any.
