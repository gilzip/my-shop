# Technical Discovery

## Business Requirement Summary

A customer should be able to cancel their own order within 1 hour of placing it, as long as it hasn't shipped — without contacting support — and never end up charged without a corresponding refund.

## Existing Capability

`cancelOrder` already exists, but it is **exclusively an Admin API capability**, gated by the generic `Permission.UpdateOrder` (there is no dedicated `CancelOrder` permission). A grep across the entire Shop API schema for anything cancellation-related returned zero matches — this is a genuine, total exposure gap, not a partially-built feature.

One near-miss worth flagging so it isn't mistaken for a solution: the Shop API's `transitionOrderToState` mutation is `Permission.Owner`-gated and looks superficially relevant, but it only operates on the customer's **active** (not-yet-placed) order — once an order is placed, `active` becomes `false` and this mutation no longer reaches it. It cannot be reused or extended for post-purchase cancellation.

## Existing Architecture Relevant to This Feature's Domain

This is the single most important discovery finding, and it directly changes what "not yet shipped" means as an implementation detail:

**The core order state machine does not block cancellation of a shipped or even delivered order.** `Cancelled` is reachable from every state, including `Shipped`, `PartiallyShipped`, `Delivered`, and `PartiallyDelivered`. The business's "hasn't shipped yet" rule is not something the framework already enforces — it is a **new guard this feature must add**, not a pre-existing constraint to merely respect.

The good news: `Order.state` reliably reflects shipped status already, because Fulfillment and Order state are kept in sync automatically — when a Fulfillment transitions to `Shipped`, the parent Order auto-transitions to `Shipped` or `PartiallyShipped`. So checking `order.state` is a valid, sufficient way to determine "has this shipped," without needing to separately query Fulfillments in the common case.

The underlying cancellation mechanics themselves are fully implemented and reusable: `OrderService.cancelOrder` (via `OrderModifier.cancelOrderByOrderLines`) already handles stock release and order-line zeroing correctly, ending in a transition to `Cancelled`. This part is genuine, safe reuse.

**A second critical finding**: `OrderService.cancelOrder` does **not** touch payments or refunds in any way — refund logic exists elsewhere in the codebase (only wired into the order-modification path) but is never called during cancellation. This means the business's hardest requirement — "must not be charged without a refund" — is **entirely unimplemented by the framework** and must be added as new logic in this feature, not assumed to come for free alongside the existing cancellation mechanics.

## Similar Implementations

Two existing patterns are directly reusable:

1. **Ownership check**: the Shop API's own `order(id)` query pattern — require `ctx.authorizedAsOwnerOnly`, then compare `idsAreEqual(ctx.activeUserId, order.customer?.user?.id)`. This is exactly "only cancel your own order," already proven correct elsewhere in the same codebase.
2. **Time-window check**: `DefaultOrderByCodeAccessStrategy.canAccessOrder` already does a "how long since `orderPlacedAt`" comparison for a different purpose (anonymous order-by-code access). The same `Date.now() - +order.orderPlacedAt < windowMs` shape applies directly to the 1-hour rule.

## Existing Business Rules Encoded in the System

- To fully cancel a *placed* order, every OrderLine must be reduced to zero quantity via `cancelOrderByOrderLines` before the state transition to `Cancelled` succeeds — an existing guard (`checkAllItemsBeforeCancel`), not something this feature needs to reimplement, since a full-order self-cancellation naturally cancels every line.
- `cancelOrderById`'s existing logic explicitly rejects cancelling an order that is still `active` (i.e., not yet placed) — consistent with this feature only applying to already-placed orders, which it is by definition (the 1-hour window starts at `orderPlacedAt`).

## Relevant Tests

None available to inspect — the installed `@vendure/core` package ships compiled `dist` only, no test sources. All conclusions above come from reading the real compiled logic (state machine tables, guard conditions, actual method bodies), not from tests or general framework documentation.

## Reuse Opportunities

- Full reuse of `OrderService.cancelOrder`/`OrderModifier.cancelOrderByOrderLines` for the actual cancellation mechanics (stock release, line zeroing, state transition).
- Full reuse of the ownership-check pattern from the Shop API's `order(id)` resolver.
- Full reuse of the `orderPlacedAt`-based time-window pattern from `DefaultOrderByCodeAccessStrategy`.
- Reuse of `order.state` (no new Fulfillment-querying logic needed) for the "not yet shipped" check.

## Required Changes

1. A new customer-facing Shop API mutation (no equivalent exists today) that: verifies ownership, verifies the 1-hour window against `orderPlacedAt`, verifies `order.state` is not `Shipped`/`PartiallyShipped`/`Delivered`/`PartiallyDelivered`, and only then calls the existing `OrderService.cancelOrder` logic.
2. New logic to check whether the order has a settled/authorized payment and, if so, issue a refund/reversal as part of the same operation — this is genuinely new, since core's cancellation path does not do this.

## New Business Behavior

The customer-facing exposure and the three eligibility guards (ownership, time window, not-shipped) are new. The refund-on-cancellation behavior is also new, in the sense that no existing code path already does it for this trigger (order cancellation) even though refund mechanics exist elsewhere in the system for a different trigger (order modification).

## Relevant Files

- Wherever the project's custom Shop API extensions should live — this project has no existing precedent for a custom GraphQL resolver/plugin (all three prior features were config-only registrations), so the Architect stage needs to decide the right shape (likely a small custom plugin, since this requires new schema + resolver, not just a config object like the previous three features).
- No entity/migration change anticipated — this feature is pure business logic over existing entities/fields (`Order.state`, `Order.orderPlacedAt`, existing Payment/Refund mechanics), not a schema change.

## Evidence from Source

- `node_modules/@vendure/core/dist/api/schema/admin-api/order.api.graphql` and `dist/api/resolvers/admin/order.resolver.js` — confirms `cancelOrder` is `Permission.UpdateOrder`-gated, Admin-only.
- `node_modules/@vendure/core/dist/api/resolvers/shop/shop-order.resolver.js` — confirms no cancellation exists on Shop API; confirms the ownership-check pattern (`ctx.authorizedAsOwnerOnly`, `idsAreEqual`); confirms `transitionOrderToState`'s scope is limited to active orders.
- `node_modules/@vendure/core/dist/config/order/default-order-process.js` — full state transition graph; confirms `Cancelled` is reachable from every state; confirms the `checkAllItemsBeforeCancel` guard.
- `node_modules/@vendure/core/dist/config/fulfillment/default-fulfillment-process.js` — confirms Order/Fulfillment state auto-sync on shipment.
- `node_modules/@vendure/core/dist/service/services/order.service.js` and `dist/service/helpers/order-modifier/order-modifier.js` — the real `cancelOrder`/`cancelOrderByOrderLines` implementation; confirms no refund logic is invoked from this path.
- `node_modules/@vendure/core/dist/config/order/order-by-code-access-strategy.js` — the reusable time-window comparison pattern.
- `node_modules/@vendure/core/dist/entity/order/order.entity.d.ts` — `orderPlacedAt` field.

## Open Questions

The business requirement itself flagged a timing-race question (shipped-a-second-before-cancel-request) as a technical detail for this stage. Given the finding that Order/Fulfillment state transitions are synchronous and the check happens at the moment the mutation runs, the practical answer is: **checking `order.state` at the moment of the cancellation request is the correct and sufficient guard** — there's no meaningfully narrower race to design around beyond normal database-transaction consistency, which the Architect should confirm is handled the same way the existing state-transition code already handles it (i.e., within the same request-scoped transaction as the rest of the mutation), not as new transaction-handling logic.
