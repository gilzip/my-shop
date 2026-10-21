# Review: Customer Self-Service Order Cancellation

Two review cycles. **Cycle 2 (final) is at the bottom**; cycle 1 is kept as history.

## Cycle 1 review (superseded)

No `git diff` exists (the repo is not under version control), so everything below was verified by reading the actual files, re-running the type-check/build myself, booting the server standalone, and running **my own** live test script (`scratchpad/review_tests.py` and `review_r10_only.py`) with different inputs than the Developer's (variants 9/10, quantity 2, shipping method 2, different customers and payment mixes), plus probes the Developer did not run. The Developer's own script was not reused.

### Verdict summary

The implementation is solid and most of it is better than the approved design. **One blocking defect**: an *unauthenticated* caller who only holds the order code can cancel a **registered** customer's order. That breaks the business rule "must never allow cancelling an order that isn't theirs" (Story 4). The fix is small and does not affect guest orders. Details under "Required changes".

### Judgement on the four corrections to the approved design

1. **Void Authorized payments, refund only Settled ones - correct.** `OrderService.refundOrder` rejects orders in `PaymentAuthorized` (`order.service.js:1545-1548`), and an Authorized payment has captured nothing. Live: R1 (payment ends `Cancelled`, no refund row) and R3 (Declined payment left alone, Authorized one voided).
2. **Payment failures must throw, not return an error result - correct.** `transaction-wrapper.js:36-53` commits whenever the work function returns and rolls back only in `catch`. Live: R7a - the forced refund failure left the order `PaymentSettled`, the payment `Settled`, and added no refund row. A returned `REFUND_FAILED` would have committed a cancelled-but-charged order.
3. **No manual `extend enum ErrorCode` - correct.** The server refused to start with it (`generateErrorCodeEnum`); the booted schema exposes the union cleanly.
4. **`refundOrder` with explicit `shipping: 0, adjustment: 0, lines: []` - correct.** The Developer's first live run failed on `Refund.shipping NOT NULL`; the fix is evidenced by R2 passing here.

The typed-result-for-guards / throw-after-write split is sound: every typed return happens before any write. The boundary (`>= 1h` is expired) is correct: 59m50s cancelled, 1h00m10s `WINDOW_EXPIRED` (R4).

### Checklist

**1. Business request satisfaction - mostly.** Customers can cancel their own recent, unshipped order, paid orders are refunded or voided in the same transaction, and shipped/old orders are rejected (R1-R5). The exception is the ownership hole below.

**2. Reuse of Vendure's extension points - yes.** One plugin using `shopApiExtensions`, `OrderService.cancelOrder/cancelPayment/refundOrder`, `orderByCodeAccessStrategy`. No parallel mechanism, no new entity. `cancelMyOrder` is absent from the Admin schema and the admin `cancelOrder` is still there (R6).

**3. Preservation of existing behaviour - yes.** R9: an untouched checkout still gets the first-order discount, the Israel free-shipping method still appears at the threshold, and an Apple-Pay payment still settles. The change adds no entity and the drift check reports "No changes in database schema were found"; `src/migrations` still holds exactly the 5 earlier migrations.

**4. Coherent behaviour across the payment lifecycle - yes.** Order, payment and refund states stay consistent in every combination tested: Authorized, Settled, Declined+Authorized, and the failure paths. Stock is released: allocation went 0 → 2 on placing and back to 0 on cancelling (R1).

**5. Correct registration - yes.** Plugin listed in `vendure-config.ts`; schema, union resolution and error type all work.

**6. Test coverage - good, with gaps now closed or listed.** Beyond the Developer's 10 checks I verified: stock release, mixed Declined+Authorized payments, all four shipped-family states, exact boundary with margins, **5 simultaneous cancels of one Settled order → exactly one succeeds, four get `NOT_CANCELLABLE`, one refund row** (R8), and the registered-customer ownership paths the Developer disclosed as untested (R10: another logged-in customer → `FORBIDDEN`; the owner → succeeds with a refund). No automated test is committed (standing project gap).

**7. Focused scope - yes.** One plugin directory plus one import and one array entry in `vendure-config.ts`; nothing unrelated.

**8. No unnecessary infrastructure - yes.**

### Required changes (blocking)

#### 1. A registered customer's order can be cancelled by anyone holding only the order code (R10b)

Evidence: a registered, logged-in customer placed an order. A brand-new **anonymous** session, sending only that order's code, received `{ __typename: 'Order', state: 'Cancelled' }` and the order was cancelled. Reproduced three times.

Cause: ownership is delegated entirely to `orderByCodeAccessStrategy.canAccessOrder`. For a request with no logged-in user it grants access for 2 hours after placement to *anyone* holding the code - sensible for reading a guest's order, because a guest has no other identity. Applied unchanged to a destructive action on a registered customer's order, it means the code alone is enough, although a stronger identity (the login) exists and is simply not required. The design accepted this as "pre-existing `orderByCode` risk", but that reasoning covers *reading* an order; `stories.md` Story 4 and the business requirement say a customer must never be able to cancel an order that isn't theirs, "by guessing **or otherwise obtaining**" its identifier.

Required fix (small, guest flow unchanged): after the existing `canAccessOrder` check, add - if the order belongs to a registered customer (`order.customer?.user` is set), the caller must be that user:
```ts
const ownerUserId = order.customer?.user?.id;
if (ownerUserId != null && !idsAreEqual(ctx.activeUserId, ownerUserId)) {
    throw new ForbiddenError(LogLevel.Verbose);
}
```
(`idsAreEqual` is exported from `@vendure/core`.) Guest orders - no linked user - keep code-based access.

Acceptance for the re-review: (a) anonymous + code on a registered customer's order → `FORBIDDEN`, order unchanged; (b) the logged-in owner → still succeeds (R10c); (c) another logged-in customer → still `FORBIDDEN` (R10a); (d) a guest holding the code of a guest order → still succeeds (R1-R4). Update `architecture.md` (ownership section and the "accepted risk" wording) and add the anonymous-on-registered case to `stories.md` Story 4.

### Recommended, not blocking

- **Partially refunded payments make self-cancellation impossible (R7b).** If a payment already has a refund smaller than its amount (e.g. an admin refunded part of it), `refundOrder(amount: payment.amount)` returns `REFUND_AMOUNT_ERROR`, the code throws, and everything rolls back. It fails *safe* (nothing is cancelled, nobody is shortchanged) but the customer can never self-cancel that order. Better: refund `payment.amount` minus the sum of that payment's non-Failed refunds (Vendure's own `getPaymentRefundTotal` counts Pending ones too), and skip the refund when nothing remains.
- **Failure messages leak internals to the customer.** Thrown errors reach the client as `INTERNAL_SERVER_ERROR` with text such as "Could not refund payment 34 for order ...: REFUND_AMOUNT_ERROR" (a sequential payment id and an internal code). Use a generic message to the caller and log the detail server-side.
- **Refunds remain `Pending` with this project's handlers** (disclosed; neither handler implements `createRefund`). Assessed: acceptable for the simulated handlers, since a Refund for the full amount is recorded and linked to the payment. But "never charged without a refund" is only fully true once a real PSP handler settles the refund - note this for whoever integrates one.
- **Non-SQLite databases are untested.** The 5-way concurrency test passed on SQLite, which effectively serialises writes. On Postgres/MySQL two truly concurrent transactions could both pass the guards; the second would then fail inside `cancelOrder`/the refund-amount check and roll back, so double-refunding looks prevented, but it was not demonstrated.

### Environment note (not caused by this feature)

Running the server and the worker as two processes against the one SQLite file produced intermittent `SqliteError: database is locked` on unrelated mutations (e.g. `setOrderShippingAddress`) during my run; my worker-less runs had none. This affects the project's normal `vendure dev all` setup and any mutation, not just this plugin; a production database avoids it.

### Verdict

Cycle 1 verdict: FAIL

---

## Cycle 2 review (final) - re-review after the ownership fix

Independent again: I read the actual fixed resolver, rebuilt, booted the server standalone (worker-less, to avoid the SQLite lock contention noted in cycle 1) and ran a **fresh** script (`scratchpad/rev2.py`) that I wrote for this cycle, not the Developer's scripts and not my cycle-1 ones. It registers three real test customers through the Shop API (generated throwaway passwords, never printed; verification tokens read from `authentication_method`).

### What changed

`order-self-cancellation.resolver.ts` gained the `idsAreEqual` import and one check placed directly after `canAccessOrder`: if `order.customer?.user?.id` exists, the caller's `ctx.activeUserId` must equal it, otherwise `ForbiddenError`. Guest orders (no linked user) keep code-based access. `architecture.md` (new "Correction made after the first review"), `stories.md` (Story 4) and `implementation.md` ("Fix cycle 1") were updated and say the same thing as the code.

### Is the fix correct and complete? Bypasses I tried

| Bypass candidate | Result |
|---|---|
| Anonymous caller + code on a registered customer's order (the original defect) | `FORBIDDEN`, order and payment unchanged (T1) |
| Same rejection must not reveal that the order exists | The rejection is byte-identical to the one for an unknown code (T1b) |
| Probing an already-**cancelled** registered order anonymously (would leak state if the typed guards ran before the ownership check) | `FORBIDDEN`, not `NOT_CANCELLABLE` - ownership is checked first (T3b) |
| A different logged-in customer | `FORBIDDEN`, unchanged (T2) |
| A guest places an order, **later registers with the same email** | Vendure links the new user to the existing Customer (`customer.userId` went `None → 16`), so the older order becomes login-protected: anonymous code-holder `FORBIDDEN`, the newly registered owner can cancel it (T8, T8b). Consequence worth knowing: such a person must log in to cancel their earlier guest order. |
| Order's customer is soft-deleted (relation may not load) | Fails closed - anonymous + code → `FORBIDDEN` (T9) |
| `customer.user` not loaded / ID type mismatch | Not an issue: the relation is requested explicitly, and `idsAreEqual` compares stringified IDs - the owner succeeds in T3/T4/T5/T6 |
| A logged-in **admin** session calling the Shop API | By code reading only: `canAccessOrder` rejects any logged-in user who isn't the owner, and the new check does too. Not run live (no admin login in this session). |

I found no bypass. The fix is correct and complete for what the Stories require.

### Live results (12/12)

| # | Check | Result |
|---|---|---|
| T1 / T1b | anonymous + code, registered customer's Authorized order | `FORBIDDEN`, unchanged; identical to unknown-code response |
| T2 | other logged-in customer | `FORBIDDEN`, unchanged |
| T3 | owner, Authorized payment | cancelled, payment voided |
| T3b / T3c | anonymous probe after cancellation / owner cancels twice | `FORBIDDEN` / typed `NOT_CANCELLABLE` |
| T4 | owner, Settled payment | cancelled, one refund of the full 18249 |
| T5 | owner, 90 min old | typed `WINDOW_EXPIRED`, unchanged |
| T6 | owner, shipped | typed `ALREADY_SHIPPED`, unchanged, no refund |
| T7 | **guest** order, anonymous code-holder | still succeeds, payment voided |
| T8 / T8b | guest later registers | older order protected; owner can cancel |
| T9 (info) | soft-deleted customer | `FORBIDDEN` |

Static checks: `tsc --noEmit` clean; production build clean; drift check reports "No changes in database schema were found" (nothing written to the scratch dir); `src/migrations` still holds exactly 5 files.

### Checklist

1. **Business request** - satisfied, and Story 4's "never an order that isn't theirs" now holds for registered customers.
2. **Reuse of extension points** - unchanged and sound (plugin + `OrderService` + the framework's own access strategy; the fix reuses the exported `idsAreEqual`).
3. **Preservation of existing behaviour** - the Developer's 10-check guest suite still passes per `implementation.md`, and my fresh T7 confirms guest cancellation is unaffected; no schema or other-feature changes.
4. **Coherent lifecycle** - Authorized voided, Settled refunded in full, typed errors unchanged, order/payment/refund states consistent across all cases.
5. **Registration** - unchanged and correct.
6. **Test coverage** - now includes the registered-customer paths, the leak-through-error-shape probe and the guest-then-register case. Still no committed automated test (standing project-wide gap).
7. **Focused scope** - the fix is one import and one 4-line check; documentation updated to match.
8. **No unnecessary infrastructure** - none added.

### Cycle-1 recommendations - still open (all non-blocking, left for a decision)

- **Partially refunded payments block self-cancellation** (fails safe, never cancels): refund only the remaining refundable amount.
- **Customer-visible failure text exposes internals** (payment id, `REFUND_AMOUNT_ERROR`): use a generic message, log the detail.
- **Refunds stay `Pending`** with this project's simulated handlers (no `createRefund`); settle for real once a PSP handler exists.
- **Not demonstrated on non-SQLite databases**; the 5-way concurrency test passed on SQLite only.
- Environment note: server + worker on one SQLite file gives intermittent "database is locked" on any mutation (unrelated to this plugin).

### New findings in cycle 2

None blocking. One behaviour to be aware of, not a defect: a person who bought as a guest and later registers with the same email must log in to cancel the earlier order.

### Verdict

```
PASS
```
