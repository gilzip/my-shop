# Architecture: Customer Self-Service Order Cancellation

## Verified Architecture

Independently re-verified every load-bearing discovery claim, and resolved the one open question, against the real installed `@vendure/core`:

1. **`Cancelled` is reachable from `Shipped`/`Delivered`** — confirmed directly in `default-order-process.js`'s transition table. Re-confirmed the `checkAllItemsBeforeCancel` guard only blocks the transition if order lines aren't already cancelled first — it does not block based on shipped status. **The "not yet shipped" rule genuinely does not exist in the framework and must be added by this feature.**
2. **`cancelOrder`/`cancelOrderByOrderLines` never touch refund logic** — re-confirmed via an exhaustive grep of both methods' bodies for "refund" (case-insensitive): zero matches inside cancellation code; all refund-related code lives in unrelated methods (`refundOrder`, `modifyOrder`). Confirmed refund must be triggered by new code.
3. **`OrderService.refundOrder(ctx, { paymentId, amount, reason })`** is the correct call — `paymentId` is mandatory (refunds are per-`Payment`, not per-`Order`), and it rejects orders not yet `PaymentSettled`. `OrderService` is a plain injectable NestJS provider, callable directly from a plugin's own resolver/service, not only via the Admin API.
4. **Adding a Shop API mutation requires a real plugin** (first one in this project) — confirmed via `VendurePluginMetadata.shopApiExtensions: { schema, resolvers }`, with `DefaultSearchPlugin`'s own `ShopFulltextSearchResolver` as a working, bundled example of exactly this pattern.
5. **An outer `@Transaction()` decorator on the new resolver method is the correct, safe pattern** — confirmed `OrderService`'s own internal transaction wrapper joins an existing transaction from context rather than nesting, per its own code comment: *"Joins any existing transaction in ctx, so callers that already have `@Transaction()` are unaffected."* This means the guards + `cancelOrder` + `refundOrder` calls, run inside one `@Transaction()`-decorated resolver method with the same `ctx` threaded through, will commit or roll back together correctly.
6. **Guest ownership cannot use `activeUserId`-to-`customer.user.id` comparison — this is the single most important finding of this stage.** That comparison always fails for guest orders (`customer.user` is `null`). It also can't use `ActiveOrderService` (stops working once `order.active` becomes `false` at placement). The correct, already-existing mechanism is `orderByCodeAccessStrategy.canAccessOrder(ctx, order)` — the exact function backing the Shop API's own `orderByCode` query — which handles both cases correctly: a logged-in customer via `activeUserId` match, and a guest via a time-window check against `orderPlacedAt` (default 2 hours). **This feature must identify the order by code (like `orderByCode` does), not by a bare id**, and reuse this same access-strategy call for ownership, rather than inventing a new identity check.

No claim needed correction beyond resolving item 6, which discovery correctly flagged as needing an architectural answer rather than assuming one.

## Design Principle Applied

Reuse existing mechanisms at every layer: the plugin/schema-extension mechanism for exposing new API surface, `orderByCodeAccessStrategy` for ownership (rather than a new identity check), `OrderService.cancelOrder` for the cancellation mechanics, and `OrderService.refundOrder` for the refund - the only genuinely new code is the guard sequencing and the new mutation's schema/resolver wiring, not any of the underlying mechanisms.

## Proposed Design

**A new plugin**, `src/plugins/order-self-cancellation/` (the project's first real plugin, per `src/plugins/`'s established-but-unused convention - previous features were all config-object registrations, none needed new schema before).

**Schema extension** (`shop-api-extensions.ts`):
```graphql
extend type Mutation {
    cancelMyOrder(orderCode: String!): CancelMyOrderResult!
}
union CancelMyOrderResult = Order | OrderCancellationError
type OrderCancellationError implements ErrorResult {
    errorCode: ErrorCode!
    message: String!
    reason: OrderCancellationReason!
}
enum OrderCancellationReason {
    ORDER_NOT_FOUND
    WINDOW_EXPIRED
    ALREADY_SHIPPED
    REFUND_FAILED
}
```

Identifying the order **by `orderCode` (not a bare id)** is a deliberate consequence of finding 6 - it's the same identification shape as the existing `orderByCode` query, and lets the ownership check reuse `orderByCodeAccessStrategy.canAccessOrder` uniformly for both logged-in customers and guests, rather than branching the logic by customer type.

**Resolver** (`order-self-cancellation.resolver.ts`), guard sequence inside one `@Transaction()`-decorated method:

1. Look up the order by code (mirroring `orderByCode`'s own resolver logic).
2. **Ownership** - call `configService.orderOptions.orderByCodeAccessStrategy.canAccessOrder(ctx, order)`; reject with `ORDER_NOT_FOUND` (not a distinct "not yours" error) if it fails, to avoid leaking whether an order exists to a non-owner - matching the existing `orderByCode` resolver's own stated anti-enumeration reasoning.
3. **Time window** - `Date.now() - +order.orderPlacedAt < ms('1h')`; reject with `WINDOW_EXPIRED` otherwise. This is a separate, stricter check from the identification window in step 2 (which defaults to 2h) - identification and cancellation-eligibility are two different questions, both must independently pass.
4. **Not shipped** - reject with `ALREADY_SHIPPED` if `order.state` is `Shipped`/`PartiallyShipped`/`Delivered`/`PartiallyDelivered`.
5. Call `orderService.cancelOrder(ctx, { orderId: order.id, lines: order.lines.map(l => ({ orderLineId: l.id, quantity: l.quantity })) })` - cancelling every line, since this is whole-order cancellation only (per business scope).
6. If the cancel succeeded, check for any `Payment` on the order in `Settled` or `Authorized` state; for each, call `orderService.refundOrder(ctx, { paymentId, amount: payment.amount, reason: 'Customer self-cancellation' })`. If a refund call fails, **the whole transaction rolls back** (return `REFUND_FAILED`, per Story 5's explicit call for this to be all-or-nothing) - chosen over "cancel anyway, flag the refund for manual follow-up" because the business requirement treats "cancelled but still charged" as strictly unacceptable, not merely undesirable, and an all-or-nothing transaction is the simplest way to structurally guarantee that outcome can't occur.

**Permission**: `@Allow(Permission.Owner)` on the mutation, same as `orderByCode`/`transitionOrderToState` - the resolver's own logic (step 2) does the real per-order ownership check; `Permission.Owner` just admits any authenticated-or-anonymous customer session to attempt the mutation at all.

## Correction made at the Developer stage (verified against real source)

The Proposed Design above says to call `refundOrder` for every payment in `Settled` **or** `Authorized` state. That is wrong for `Authorized`:

- `OrderService.refundOrder` returns `RefundOrderStateError` when the order is in `AddingItems`, `ArrangingPayment` or `PaymentAuthorized` (`order.service.js:1545-1548`). An order with only an Authorized payment is exactly in `PaymentAuthorized`.
- An Authorized payment has not captured any money, so the correct operation is to **void** it: `OrderService.cancelPayment(ctx, paymentId)` → `PaymentService.cancelPayment`, which calls the handler's `cancelPayment` hook and moves the payment to `Cancelled` (`payment.service.js:151-168`). This project's `dummyPaymentHandler` and `applePaySimulatedHandler` both implement `cancelPayment`.
- Only `Settled` payments are refunded via `refundOrder(ctx, { paymentId, amount, reason })`. That call is permitted once the order has been moved to `Cancelled` (`Cancelled` is not in the rejected-state list), so the safe sequence is **cancel the order first, then handle each payment**: Authorized → `cancelPayment`, Settled → `refundOrder`.
- Payments in any other state (`Declined`, `Error`, `Cancelled`) need nothing.

Step 6 of the resolver guard sequence is therefore: after `cancelOrder` succeeds, for each payment — `Authorized` → void; `Settled` → refund the full amount. Any failure in either call still rolls the whole `@Transaction()` back (all-or-nothing, unchanged).

Also confirmed: a plugin error result only needs a `__typename` equal to its GraphQL type name — Vendure's common `ErrorResult.__resolveType` returns `value.__typename` (`generate-resolvers.js:120-124`).

## Correction made after the first review (ownership of registered customers' orders)

The design above delegated ownership entirely to `orderByCodeAccessStrategy.canAccessOrder` and accepted, as "pre-existing `orderByCode` risk", that anyone holding an order code within 2 hours can identify (and cancel) the order. The independent review showed that is not acceptable for a **destructive** action on a **registered** customer's order: an anonymous session holding only the code cancelled such an order (review R10b). That reasoning only holds for *reading* an order, and for guests, who have no other identity.

Final rule: `canAccessOrder` is still the first check (it is what admits a guest holding a guest order's code), and **in addition**, if the order has a linked registered user (`order.customer.user`), the caller must be that logged-in user (`idsAreEqual(ctx.activeUserId, order.customer.user.id)`), otherwise `FORBIDDEN`. Guest orders keep code-based access, since the code is their only credential. The "Risks" note below about guest/code access therefore now applies **only to guest orders**.

## Files to Create/Modify

- **Create**: `src/plugins/order-self-cancellation/order-self-cancellation.plugin.ts` (the `@VendurePlugin` class, registering `shopApiExtensions`).
- **Create**: `src/plugins/order-self-cancellation/order-self-cancellation.resolver.ts`.
- **Create**: `src/plugins/order-self-cancellation/shop-api-extensions.ts` (the `gql` schema above).
- **Modify**: `src/vendure-config.ts` - add the new plugin to the `plugins` array.
- **No entity/migration change** - this feature is pure business logic over existing entities/fields.

## Registration/Configuration Needed

Only adding the new plugin class to `vendure-config.ts`'s `plugins` array - no config object, no array-replacement risk this time, since plugins are registered by list membership, not by the same wholesale-array pattern as checkers/conditions.

## Frontend/Storefront Implications

None requiring new code beyond the new mutation itself - no storefront exists in this repo (pre-existing, unrelated gap). A real storefront would call `cancelMyOrder(orderCode: ...)` from an order-history/order-detail view.

## Tests to Add

Same manual-but-real approach as the prior features, given no test framework exists:
1. A logged-in customer's own recent, unshipped, paid order → cancel succeeds, refund issued, verified via DB/GraphQL.
2. A guest's own recent, unshipped order (identified by code, no login) → cancel succeeds - this is the story that specifically exercises finding 6, and must not be skipped.
3. An order older than 1 hour → rejected `WINDOW_EXPIRED`.
4. An order already `Shipped` → rejected `ALREADY_SHIPPED`.
5. Another customer's order code, attempted by a different session → rejected `ORDER_NOT_FOUND` (not a distinct error revealing the order exists).
6. Existing Admin API `cancelOrder` still works unmodified - a direct regression check, since this feature adds a plugin but must not touch the admin path at all.

## Risks

- **Refund-failure handling (step 6) is an all-or-nothing transactional choice** - flagged explicitly here because it's a real design tradeoff (a payment gateway outage would make cancellation temporarily unavailable rather than "succeed with a dangling refund"), not something to silently assume either way.
- **Guest ownership via order code** means anyone who obtains a valid order code within its access window can identify (and, for this feature, cancel) that order - this is an accepted, pre-existing risk profile already inherent to `orderByCode`'s own design (order codes are already treated as bearer secrets by that query), not a new risk this feature introduces.
- **First plugin in this project** - low residual risk technically, but worth flagging that this is a template-setting moment: how this plugin is structured will likely be copied for the next one that needs custom schema.

## Rejected Alternatives

- **Using `activeUserId`-to-`customer.user.id` comparison as the sole ownership check.** Rejected outright - confirmed via discovery/architecture verification that this always fails for guest orders, which the business requirement explicitly requires supporting (guests are customers too, per the earlier `first-order-discount` feature's own precedent that guest orders count).
- **Reusing `ActiveOrderService`/session `activeOrderId`.** Rejected - confirmed this stops resolving the order the moment it's placed (`active` becomes `false`), which is before this feature's guards would ever even run, since the 1-hour window only makes sense post-placement.
- **"Cancel anyway, log/flag a failed refund for manual admin follow-up."** Rejected in favor of the all-or-nothing transaction - reintroduces exactly the "cancelled but still charged, now waiting on a human" outcome this feature exists to eliminate, just delayed rather than avoided.
- **Extending the existing Admin `cancelOrder` mutation with a permission/ownership branch instead of adding a new mutation.** Rejected - mixing an admin-authority mutation with customer-self-service guard logic in one resolver would make both harder to reason about and review independently; a new, narrowly-scoped mutation keeps the existing admin path completely untouched, which the Epic explicitly requires.
