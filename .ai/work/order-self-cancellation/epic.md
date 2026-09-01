# Epic: Customer Self-Service Order Cancellation

## Summary

Expose a new, customer-facing cancellation capability on the Shop API, gated by three guards (ownership, 1-hour window since `orderPlacedAt`, not-yet-shipped `order.state`), reusing Vendure's existing cancellation mechanics for the actual cancel operation, and adding new refund logic that core's cancellation path does not provide on its own.

## Why now

This is the first of three new test features chosen to stress a specific pipeline role — this one, the Technical Product Manager's discovery depth. Discovery uncovered two facts that materially reshape the Epic from a naive reading of the business request: (1) the state machine does not already block cancelling shipped orders — this feature has to add that guard itself, not merely respect an existing one; (2) core's cancellation logic never touches payments — the "must not be charged without a refund" requirement is genuinely new logic, not a byproduct of calling the existing cancel mechanism.

## What "done" looks like in the context of this product

- A customer can cancel their own, recently-placed, not-yet-shipped order through the Shop API, with no admin/support involvement.
- The same order, once shipped or past the 1-hour window, cannot be self-cancelled — the customer sees a clear rejection, not a silent no-op or a crash.
- A self-cancelled order that had a settled/authorized payment is refunded/reversed as part of the same operation — never left charged with no corresponding refund.
- The existing Admin-only `cancelOrder` continues to work exactly as before — this feature adds a new, narrower customer-facing path, it does not change the admin one.

## In Scope

- New Shop API mutation for self-cancellation.
- Ownership guard, time-window guard, not-shipped guard.
- Refund/reversal logic triggered by this new cancellation path when applicable.
- Reuse of existing `OrderService.cancelOrder` mechanics for the actual cancellation.

## Out of Scope

- Any change to the existing Admin API `cancelOrder` mutation or its permissions.
- Partial-order cancellation (cancelling only some lines).
- Cancellation fees/penalties.
- Cancellation notifications/emails.

## Dependencies

None on other in-flight work.
