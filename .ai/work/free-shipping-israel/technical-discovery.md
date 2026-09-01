# Technical Discovery

## Business Requirement Summary

A "Free Shipping" option should appear at checkout only when the shipping address is in Israel AND the order subtotal is ≥ 200 ILS. No other shipping method's behavior should change.

## Existing Capability

This project currently registers no custom shipping configuration at all — `src/vendure-config.ts` has no `shippingOptions` block. Vendure's own `default-config.js` fills that gap with `defaultShippingEligibilityChecker` and `defaultShippingCalculator`, and this project's two seeded shipping methods use exactly those defaults:

| code | name | checker (orderMinimum) | calculator (rate, minor units) |
|---|---|---|---|
| `standard-shipping` | Standard Shipping | 0 (always eligible) | 500 (5.00 ILS) |
| `express-shipping` | Express Shipping | 0 (always eligible) | 1000 (10.00 ILS) |

(Confirmed directly from `vendure.sqlite`'s `shipping_method` table.)

## Existing Architecture Relevant to This Feature's Domain

Vendure's shipping extension model, confirmed against the installed `@vendure/core`:

- A `ShippingMethod` pairs exactly one `ShippingEligibilityChecker` (`check(ctx, order, args, method) → boolean`) with exactly one `ShippingCalculator` (`calculate(ctx, order, args, method) → { price, taxRate, priceIncludesTax }`). There is no separate "is this shipping method free" flag anywhere in the schema — "free" is simply a calculator that returns `price: 0`.
- `order.shippingAddress.countryCode` is the field to check for destination (confirmed as an `OrderAddress` field, denormalized snapshot on the Order, not a live join). Israel's code in this project's own seeded `region` table is `'IL'`.
- `order.subTotalWithTax` (and `subTotal`) are integers in the currency's minor units (agorot for ILS), confirmed via the `MoneyStrategy` documentation and matching this project's own seed data (`rate: "500"` = 5.00 ILS). **200 ILS in this system is `20000`, not `200`.**

## Similar Implementations

Vendure's own `defaultShippingEligibilityChecker` is the direct pattern to follow — it already does an order-total comparison (`order.subTotalWithTax >= args.orderMinimum`) with a configurable `orderMinimum` arg. This feature's checker is that same shape, plus one additional condition (destination country).

## Existing Business Rules Encoded in the System

**A critical one, discovered only by reading the merge logic, not assumed:** `mergeConfig` (`@vendure/core`'s config-merging function) does **not** merge arrays — array-valued config options (like `shippingOptions.shippingEligibilityCheckers`) get wholesale-replaced, not appended to. If this feature's `vendure-config.ts` change sets `shippingEligibilityCheckers: [freeShippingIsraelChecker]` without also including `defaultShippingEligibilityChecker` in that same array, the two existing shipping methods (which reference `default-shipping-eligibility-checker` by code) would lose their checker at runtime — a direct violation of the business requirement's "no existing shipping behavior changes" rule. The array must explicitly include both the default and the new checker (and the same applies to `shippingCalculators` if a new calculator is added rather than reusing the default one at rate 0).

## Relevant Tests

None exist in this project (the same pre-existing, documented gap as the `variant-internal-note` feature — not something this feature should be expected to fix on its own).

## Reuse Opportunities

- **Full reuse** of `defaultShippingCalculator` for the "free" part — setting its `rate` arg to `0` achieves price-0 shipping without writing a new calculator at all.
- **Pattern reuse** (not code reuse, since the condition differs) of `defaultShippingEligibilityChecker`'s shape for the new checker.
- **Full reuse** of the existing Admin API (`createShippingMethod`, `shippingEligibilityCheckers`/`shippingCalculators` queries) to actually create the new shipping method once the checker is registered — no new API surface needed.

## Required Changes

1. A new `ShippingEligibilityChecker` (custom code) checking both destination country (`'IL'`) and subtotal (`>= 20000`).
2. `vendure-config.ts`: add a `shippingOptions.shippingEligibilityCheckers` array containing **both** `defaultShippingEligibilityChecker` and the new checker (per the merge-config rule above) — and `shippingCalculators` explicitly listing `defaultShippingCalculator` if that array is touched at all.
3. A new `ShippingMethod` row (created via the existing `createShippingMethod` Admin API mutation, or an equivalent seed/script) named "Free Shipping", using the new checker and the default calculator with `rate: 0`.

## New Business Behavior

Genuinely new: no such conditional, destination-aware free shipping exists today. The behavior itself (an order-total threshold gating a shipping method) already exists as a *pattern* (see `defaultShippingEligibilityChecker`); the destination condition is what's new.

## Relevant Files

- `src/vendure-config.ts` — add `shippingOptions`.
- A new file for the custom checker (e.g. `src/shipping-methods/free-shipping-israel-checker.ts`), mirroring how the project already isolates `applePaySimulatedHandler` under `src/payment-methods/`.
- No migration/schema change anticipated — `ShippingMethod`'s checker/calculator are stored as existing generic `ConfigurableOperation` JSON columns already present on the entity; no new column is needed for this feature.

## Evidence from Source

- `node_modules/@vendure/core/dist/config/shipping-method/shipping-eligibility-checker.d.ts` — `check` signature and JSDoc example.
- `node_modules/@vendure/core/dist/config/shipping-method/default-shipping-eligibility-checker.js` and `default-shipping-calculator.js` — the existing default implementations.
- `node_modules/@vendure/core/dist/config/default-config.js` (lines ~160-162) — confirms the defaults are supplied automatically when `shippingOptions` isn't set.
- `node_modules/@vendure/core/dist/config/merge-config.js` — confirms arrays are replaced, not merged, on config override.
- `node_modules/@vendure/core/dist/config/vendure-config.d.ts` (lines 844-863) — `ShippingOptions` interface.
- `node_modules/@vendure/core/dist/api/schema/admin-api/shipping-method.api.graphql` — `createShippingMethod` mutation and input shapes.
- Direct query against `C:\vendure\my-shop\vendure.sqlite`'s `shipping_method` and `region` tables.

## Open Questions

None blocking. One judgment call, flagged rather than silently assumed: this discovery recommends reusing `defaultShippingCalculator` at `rate: 0` rather than writing a new "free" calculator, since Vendure has no dedicated free-shipping primitive and this avoids adding code where config suffices — the Architect stage should confirm or override this choice.
