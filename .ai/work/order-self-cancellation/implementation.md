# Implementation: Customer Self-Service Order Cancellation

No `git diff` available (pre-existing gap: the repo is not under version control). Files are described directly.

## Files Changed

- **`src/plugins/order-self-cancellation/order-self-cancellation.plugin.ts`** (created) - the project's first real plugin; `@VendurePlugin` registering Shop API extensions.
- **`src/plugins/order-self-cancellation/shop-api-extensions.ts`** (created) - adds `cancelMyOrder(orderCode: String!): CancelMyOrderResult!`, the union `CancelMyOrderResult = Order | CancelMyOrderError`, and the `CancelMyOrderErrorReason` enum (`NOT_CANCELLABLE`, `WINDOW_EXPIRED`, `ALREADY_SHIPPED`).
- **`src/plugins/order-self-cancellation/order-self-cancellation.resolver.ts`** (created) - the `@Transaction()` mutation plus a tiny union `__resolveType` resolver.
- **`src/vendure-config.ts`** (modified) - imported the plugin and added `OrderSelfCancellationPlugin` to `plugins`. Nothing else in the file changed.

No entity, no migration, no change to the Admin API.

## Behaviour implemented

`cancelMyOrder(orderCode)`, evaluated in this order:

1. Look up the order by code and authorize it with `orderByCodeAccessStrategy.canAccessOrder` - the exact mechanism behind the Shop API's own `orderByCode`. A missing order and someone else's order are indistinguishable (`FORBIDDEN`). Works for logged-in customers and for guests holding the code.
2. **Read-only guards** (typed `CancelMyOrderError`, nothing written): not placed / already `Cancelled` → `NOT_CANCELLABLE`; `Date.now() - orderPlacedAt >= 1h` → `WINDOW_EXPIRED`; state in `Shipped`/`PartiallyShipped`/`Delivered`/`PartiallyDelivered` → `ALREADY_SHIPPED`.
3. `orderService.cancelOrder` (whole order).
4. For each payment: `Authorized` → `orderService.cancelPayment` (void); `Settled` → `orderService.refundOrder` for the full amount; anything else → nothing.
5. Any failure from steps 3-4 **throws**, which rolls back the entire `@Transaction()`.

## Corrections to the approved design (made during implementation, recorded in architecture.md)

1. **Authorized payments cannot be refunded** - `refundOrder` rejects `PaymentAuthorized` orders, and nothing is captured to refund anyway. They are voided with `cancelPayment` instead; only Settled payments are refunded. (Documented in architecture.md under "Correction made at the Developer stage".)
2. **A returned error result does not roll back a transaction; only a thrown error does** (`transaction-wrapper.js`). The architecture's typed `REFUND_FAILED` reason would therefore have committed a cancelled order with the payment still charged. It was dropped: payment failures throw. Typed results are used only for guards that run before any write.
3. **`extend enum ErrorCode` is wrong** - Vendure generates `ErrorCode` values automatically from every `ErrorResult` implementation; the manual extension made the server refuse to start (`Enum value ... already exists`). Removed.
4. **`refundOrder` called directly needs explicit `shipping: 0, adjustment: 0, lines: []`** - the Admin GraphQL layer normally defaults these; without them the `Refund.shipping` NOT NULL column rejects the insert. Found by the live test below (check B failed on the first run).

## Tests run (no automated framework exists in this project - live tests against the real running server)

Script: `scratchpad/cancel_tests.py`. Each case places a real order through the Shop API in its own guest session, then cancels from a *different* anonymous session holding only the order code. **10/10 pass:**

| # | Case | Result |
|---|---|---|
| A | Authorized payment (`standard-payment`) | Order `Cancelled`, payment `Cancelled` |
| B | Settled payment (`apple-pay-simulated`) | Order `Cancelled`, one Refund row for the full 2551 |
| C | 90 min old | `WINDOW_EXPIRED`, order and payment unchanged |
| C2 | 59 min old | still cancellable |
| C3 | 3 h old, guest | `FORBIDDEN` (outside Vendure's 2 h guest-access window), unchanged |
| D | `Shipped` | `ALREADY_SHIPPED`, order, payment and refunds unchanged |
| E | unknown code | `FORBIDDEN`, no detail leaked |
| F | cancel twice | second call `NOT_CANCELLABLE` |
| G | unplaced cart, guest | `FORBIDDEN`, cart untouched |
| H | refund forced to fail (a fully-refunded fixture row was inserted) | error returned **and the order is still `PaymentSettled`** - the whole transaction rolled back |

Also: `tsc --noEmit` and the production build pass; the Admin API schema does not contain `CancelMyOrderResult`, so the admin `cancelOrder` is untouched.

## Fix cycle 1 (after the first independent review returned FAIL)

The Reviewer found one blocking defect: an **anonymous** session holding only the order code could cancel a **registered** customer's order, because ownership was delegated entirely to `orderByCodeAccessStrategy.canAccessOrder`, which admits any code-holder for 2 hours when nobody is logged in. Fixed in `order-self-cancellation.resolver.ts` (+ `idsAreEqual` import): after the existing access check, if the order has a linked registered user (`order.customer.user`), the caller must be that logged-in user, else `FORBIDDEN`. Guest orders (no linked user) keep code-based access. `architecture.md` (new "Correction made after the first review" section) and `stories.md` (Story 4 criteria) were updated to match.

Verified live after the fix, with real registered test customers created on the local dev app (generated throwaway credentials, verification token read from the DB):
- anonymous + code on a registered customer's order → `FORBIDDEN`, order and payment unchanged ✓
- the logged-in owner → still cancels (Authorized order voided; Settled order refunded) ✓
- a different logged-in customer → `FORBIDDEN` ✓
- the full guest suite (A-H, 10 checks) → 10/10 still pass ✓

Not changed (reviewer's non-blocking recommendations, left for a decision): refund only the remaining refundable amount of a partially-refunded payment; replace the detailed internal error text sent to customers with a generic message; real PSP `createRefund` so refunds settle.

## Known limitations

- **Refunds stay `Pending` with this project's handlers.** Neither `dummyPaymentHandler` nor `applePaySimulatedHandler` implements `createRefund`, so Vendure records the Refund (full amount) but nothing settles it; the payment itself remains `Settled`. A real PSP handler would settle it. Check B confirms a Refund of the full amount is created and linked, not that money moved.
- ~~Registered-customer ownership was not exercised live.~~ **Now exercised** (see Fix cycle 1): owner succeeds, other logged-in customer and anonymous code-holder are `FORBIDDEN`.
- **A guest loses access after Vendure's 2 h guest window** (default `anonymousAccessDuration`), so after 2 h a guest sees `FORBIDDEN` rather than `WINDOW_EXPIRED`; a logged-in customer would see `WINDOW_EXPIRED`. Both mean "cannot cancel"; only the error shape differs.
- Not tested: concurrent double-submit of the same cancellation. The `@Transaction()` wrapper and the `Cancelled` guard make a second call return `NOT_CANCELLABLE`, but a true simultaneous race was not driven.
- No automated test is committed - same standing gap as every prior feature.
