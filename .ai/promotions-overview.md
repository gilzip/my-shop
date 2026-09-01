# Promotion Types & Discounts — my-shop (Vendure 3.7.2)

Reference document analyzing every promotion condition and action available in this project, grounded directly in the real installed `@vendure/core` source (`node_modules/@vendure/core/dist/config/promotion/`) and this project's own custom additions — not from general Vendure documentation, since exact `code` strings and behavior are version-specific and two were found to differ from what a name would suggest (see the correction note at the end).

Companion to [`.ai/modules-overview.md`](modules-overview.md) (which lists the Promotions module at a higher level) — this document goes one level deeper, into the actual condition/action catalog.

## How a Promotion works, in this codebase's own terms

A `Promotion` is a `couponCode` (optional — omit it for an automatic, no-code promotion) plus a list of **conditions** (all must pass) and a list of **actions** (each computes a discount amount once conditions pass). Conditions and actions are independently pluggable — registered by `code` string in `vendure-config.ts`'s `promotionOptions`, referenced by that same code in each `Promotion` row's own `conditions`/`actions` JSON columns.

**Actions come in four distinct shapes**, not one — this matters because it determines exactly *what* gets discounted and *how the amount scales*:

| Base class | Applies to | Scales with quantity? | Used by |
|---|---|---|---|
| `PromotionOrderAction` | the whole order | n/a (one amount for the order) | `order_fixed_discount`, `order_percentage_discount` |
| `PromotionItemAction` | each OrderLine | **yes** — return value is a per-unit amount, multiplied by the line's quantity | `products_percentage_discount`, `facet_based_discount`, `buy_x_get_y_free_action`, this project's custom `buy_x_get_y_discount` |
| `PromotionLineAction` | each OrderLine | **no** — flat amount per line regardless of quantity | `order_line_fixed_discount` |
| `PromotionShippingAction` | a specific ShippingLine | n/a | `free_shipping` |

## Conditions (5 built-in + 1 custom)

| Code | Args | What it checks |
|---|---|---|
| `minimum_order_amount` | `amount` (int, default 100), `taxInclusive` (bool, default false) | `order.subTotal` (or `subTotalWithTax`) `>=` amount. **The only condition with a non-zero `priorityValue` (10)** — see Ordering below. |
| `at_least_n_with_facets` | `minimum` (int, default 1), `facets` (ID list) | Sums the quantity of every OrderLine whose variant/product carries *all* the given facet values; passes if that sum `>= minimum`. |
| `contains_products` | `minimum` (int, default 1), `productVariantIds` (ID list) | Same accumulation pattern as above, but matches by exact variant ID membership rather than facets — despite the name, it matches at the **variant** level. |
| `customer_group` | `customerGroupId` (ID) | Fails immediately if the order has no customer; otherwise checks group membership via a **1-week TTL cache** (keyed per customer, invalidated on `CustomerGroupChangeEvent`) — the only condition with caching and an event-driven `destroy()` lifecycle hook. |
| `buy_x_get_y_free` | `amountX`/`variantIdsX` (the "buy" side), `amountY`/`variantIdsY` (the "get" side) | Computes how many "buy" multiples of X occurred, then allocates up to `amountY` free units across the cheapest matching Y lines. Stores the result as `freeItemsPerLine` (order line id → qualifying quantity) in shared condition state, readable by any action declaring `conditions: [buyXGetYFreeCondition]`. |
| `is_first_order` **(custom)** | none | True only if the customer has no other order with `orderPlacedAt` set. Added by the `first-order-discount` feature — [technical-discovery.md](work/first-order-discount/technical-discovery.md). |

## Actions (7 built-in + 1 custom)

| Code | Class | Args | What it discounts |
|---|---|---|---|
| `order_fixed_discount` | Order | `discount` (int, currency) | Fixed amount off the order, **clamped** so it can never exceed the order's own subtotal (can't go negative). |
| `order_line_fixed_discount` | Line | `discount` (int, currency) | Flat amount off a qualifying line, **not scaled by quantity** — same deduction whether the line has 1 unit or 50. |
| `order_percentage_discount` | Order | `discount` (float, %) | Percentage off the whole order's subtotal. Used by this project's `first-order-discount` promotion. |
| `facet_based_discount` | Item | `discount` (float, %), `facets` (ID list) | Percentage off the **unit price** of every line whose variant/product carries the given facet values — scales per unit since it's an Item action. |
| `products_percentage_discount` | Item | `discount` (float, %), `productVariantIds` (ID list) | Percentage off the unit price of specific variants — **unconditionally**, no linkage to any "buy X" condition. |
| `free_shipping` | Shipping | none | Zeroes out a specific ShippingLine's cost entirely (full price refunded, tax-inclusive or exclusive per the line's own setting). |
| `buy_x_get_y_free_action` | Item | none | 100% off the units `buy_x_get_y_free` allocated as free — reads `state.buy_x_get_y_free.freeItemsPerLine`. Uses a `freeQuantity / orderLine.quantity` division that the framework's later per-unit multiplication cancels back out to the exact intended amount. |
| `buy_x_get_y_discount` **(custom)** | Item | `discountPercentage` (float, %) | This project's own action — same `buy_x_get_y_free` linkage and scaling technique as the built-in free action, but with a *configurable partial* discount instead of always 100%. Added by `buy-x-get-y-discount` — [technical-discovery.md](work/buy-x-get-y-discount/technical-discovery.md) / [implementation.md](work/buy-x-get-y-discount/implementation.md). |

## Ordering when multiple promotions apply

`Promotion.priorityScore` isn't set directly — it's computed as the **sum of every attached condition's and action's `priorityValue`**, recalculated on every create/update. Promotions are then evaluated in **ascending** `priorityScore` order (lower score first). Since `minimum_order_amount` is the only item in the whole catalog with a non-zero `priorityValue` (10), a promotion using it is deliberately evaluated later than promotions built only from zero-priority pieces.

## Custom additions in this project

Both are described in full above and cross-referenced to their originating feature:
- `is_first_order` (condition) — enables "first order" style promotions with zero new discount logic (pairs with any existing action, e.g. `order_percentage_discount`).
- `buy_x_get_y_discount` (action) — enables a *partial* buy-X-get-Y discount, filling the one real gap in the built-in catalog (which only offered 100% off for that shape).

## Currently configured Promotions in this dev database

| Name | Condition(s) | Action(s) |
|---|---|---|
| First Order 10% Off | `is_first_order` | `order_percentage_discount` (10%) |
| Buy Laptop Get Mouse 50pct Off | `buy_x_get_y_free` (1 Laptop → up to 2 Mice) | `buy_x_get_y_discount` (50%) |

## Correction note (for anyone who saw the earlier, less careful answer in chat)

An earlier informal summary in this conversation guessed two condition/action `code` strings from their variable names rather than reading the source. Both were wrong, and are corrected here:
- `hasFacetValues`'s real code is **`at_least_n_with_facets`**, not `has_facet_values`.
- `discountOnItemWithFacets`'s real code is **`facet_based_discount`**, not `discount_on_item_with_facets`.

This document supersedes that earlier chat answer for anything that disagrees with it.
