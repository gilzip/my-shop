# Stories: Customer Self-Service Order Cancellation

## Story 1 — A customer cancels their own qualifying order

**User story**
As a customer whose order was placed less than an hour ago and hasn't shipped, I want to cancel it myself, so I don't have to contact support for something I can safely undo immediately.

**Business context**
The core capability the business requirement asks for.

**Acceptance criteria**
- Given an order the requesting customer owns, placed less than 1 hour ago, in a state prior to any shipment, when they request cancellation, then the order transitions to `Cancelled` and its lines are zeroed out via the existing cancellation mechanics.

**Business rules**
- All three guards (ownership, time window, not-shipped) must pass — this story covers the case where all three do.

**Edge cases**
- An order with zero lines already (shouldn't normally happen, but shouldn't crash) should be handled gracefully by the existing `cancelOrder` logic it delegates to.

**Dependencies**
None.

**Out of scope**
Any UI beyond what the Shop API exposes generically.

**Relevant existing capability**
`OrderService.cancelOrder`/`OrderModifier.cancelOrderByOrderLines` already implement the actual cancellation mechanics (stock release, line zeroing, state transition) - this story's new work is entirely in front of that call (the guards), not the mechanics themselves.

---

## Story 2 — A customer cannot cancel an order outside the 1-hour window

**User story**
As the business, I want the free self-cancellation window to be strictly time-limited, so it stays a narrow, low-risk convenience rather than an open-ended cancellation right.

**Business context**
Directly from the business requirement's rules.

**Acceptance criteria**
- Given an order placed more than 1 hour ago, when the customer requests self-cancellation, then it is rejected with a clear reason, and the order is not modified.

**Business rules**
- The window is measured from `orderPlacedAt`, not from account age or any other timestamp.

**Edge cases**
- An order placed at almost exactly the 1-hour boundary should be evaluated consistently (a clear ≥/< rule, not a fuzzy one) - the Architect should pick and document one direction rather than leaving it ambiguous.

**Dependencies**
Story 1 (the mutation must exist to verify what it rejects).

**Out of scope**
Any configurability of the window length for this version - it's fixed at 1 hour per the business requirement.

---

## Story 3 — A customer cannot cancel an order that has already shipped

**User story**
As the business, I want self-cancellation to stop being available the moment an order ships, so customers can't self-cancel something already in motion in the real world.

**Business context**
Directly from the business requirement, and the single most important guard given discovery's finding that the framework does **not** already block this.

**Acceptance criteria**
- Given an order in `Shipped`, `PartiallyShipped`, `Delivered`, or `PartiallyDelivered` state, when the customer requests self-cancellation, then it is rejected with a clear reason, regardless of how recently it was placed.

**Business rules**
- This check takes priority over the time-window check in the sense that both must independently hold - a very recent order that has (unusually) already shipped must still be rejected.

**Edge cases**
- An order that ships at almost the same moment the cancellation request is made should resolve consistently based on whatever state the order is actually in at the moment the guard runs, within the same transaction as the rest of the mutation - not a separately-timed check that could see stale state.

**Dependencies**
Story 1.

**Out of scope**
Any change to how Fulfillment/Order state transitions themselves work - this story only adds a read-only guard against existing state.

---

## Story 4 — A customer cannot cancel someone else's order

**User story**
As the business, I want to guarantee a customer can only ever cancel their own order, so this convenience feature can never be used to disrupt someone else's purchase.

**Business context**
A hard security/business boundary, not a tunable preference.

**Acceptance criteria**
- Given an order belonging to a different customer, when the requesting customer attempts to cancel it (e.g. by guessing or otherwise obtaining its id), then the request is rejected the same way as if the order didn't exist - no information about the order's existence or state should leak to a non-owner.

**Business rules**
- Ownership is determined the same way the rest of the Shop API already does it for the `order(id)` query - no new identity rule invented for this feature.

**Edge cases**
- A guest order (no registered `User`) should be handled correctly by the same ownership pattern - the Architect should confirm exactly how ownership resolves for guest orders (likely: guests can't call an authenticated-owner-only mutation at all, since `ctx.authorizedAsOwnerOnly` implies some form of session identity) rather than this story assuming an answer.

**Dependencies**
Story 1.

**Out of scope**
Any change to how guest identity/ownership works generally.

---

## Story 5 — A cancelled order with a settled payment is refunded, never left charged

**User story**
As a customer who paid for an order and then cancelled it within the eligible window, I want my money back automatically, so cancelling doesn't leave me out of pocket for nothing.

**Business context**
The business requirement's hardest, most explicit rule - and the one discovery found is entirely unimplemented by the framework's existing cancellation path.

**Acceptance criteria**
- Given an order with a settled or authorized payment, when it is successfully self-cancelled, then a refund/reversal for the full paid amount is issued as part of the same operation - not a separate manual step.
- Given an order with no payment yet taken (e.g. still `ArrangingPayment`), when it is successfully self-cancelled, then no refund step is attempted (there's nothing to refund) and this does not block the cancellation.

**Business rules**
- "Cancelled but still charged" is an explicitly unacceptable outcome per the business requirement - if the refund step fails, the Architect/Developer stages need to decide whether the cancellation itself should also fail (all-or-nothing) or succeed with a flagged/retryable refund failure. This document does not decide that - it's exactly the kind of technical judgment call that belongs to the Architect stage, made explicit here so it isn't silently assumed either way.

**Edge cases**
- An order with multiple payments (e.g. a settled payment plus a failed retry) should only refund the payment(s) actually charged, not attempt to "refund" one that was never settled.

**Dependencies**
Story 1.

**Out of scope**
Any change to the refund mechanism itself (e.g. how a specific payment method processes a refund) - this story only concerns triggering the existing refund capability at the right moment.
