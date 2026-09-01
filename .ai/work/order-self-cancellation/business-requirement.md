# Business Requirement

## Business Problem

Today, a customer who changes their mind right after placing an order (wrong item, wrong address, ordered twice by mistake) has no way to undo it themselves. They have to contact support and wait for a human to act, even in the very common case where nothing has happened yet on the fulfillment side. This creates unnecessary support load for a problem the customer could resolve instantly on their own.

## Business Objective

Reduce support contacts related to "I need to cancel my order" for the common, low-risk case of a very recent order that hasn't started fulfillment yet, while keeping full control over cancellation once an order has progressed too far to safely undo.

## Target User

- **In scope**: any customer who placed an order within the last hour, where that order has not yet shipped.
- **Explicitly not for**: customers whose order has already shipped, or whose order is older than one hour — those customers still go through the existing support-assisted process, unaffected by this change.

## Business Value

- Removes a common, avoidable category of support requests, freeing support capacity for issues that actually need a human.
- Improves customer trust and satisfaction — being able to immediately fix a mistake is a baseline expectation at most online retailers today.
- Low risk: the one-hour, not-yet-shipped window is chosen specifically because cancelling at that point has essentially no operational cost to the business.

## Desired Capability

A customer looking at one of their own recent orders can cancel it themselves, immediately, without contacting support, as long as it's within the eligible window. Once cancelled, the order is unambiguously cancelled — the customer sees it reflected right away, and it does not get fulfilled or charged further.

## Business Rules

- Self-cancellation is only available within 1 hour of the order being placed.
- Self-cancellation is only available if the order has not yet shipped.
- Once either condition is no longer true, the customer must go through the existing support-assisted cancellation process — this feature does not change or remove that process, it only adds a faster path for the qualifying window.
- A customer can only cancel their own order — this must never allow cancelling an order that isn't theirs.
- If the order has already been paid for, cancellation must result in the customer not being charged (via refund or reversal) — this is a hard requirement, not a nice-to-have, since a "cancelled but still charged" outcome would be worse than no self-service option at all.

## Success Criteria

- A customer can cancel a qualifying order (within the window, not yet shipped) entirely on their own, with no support contact needed.
- A customer cannot cancel an order outside the window, or one that has already shipped, or one that belongs to someone else.
- A cancelled order never results in the customer being charged without a corresponding refund/reversal.

## Scope

- Customer-initiated cancellation of their own order, gated by the one-hour/not-shipped window described above.

## Out of Scope

- Any change to the existing support-assisted cancellation process for orders outside this window.
- Partial cancellation (cancelling only some items in an order) — this requirement is about cancelling the whole order.
- Any cancellation fee or penalty — within the eligible window, cancellation is free and unconditional (aside from the eligibility rules above).
- Any notification/email about the cancellation — how (or whether) the customer is notified beyond seeing the order status change is not addressed by this requirement.

## Open Business Questions

None blocking. One thing flagged rather than assumed: whether "not yet shipped" should be judged the moment the customer clicks cancel, or whether there's an acceptable-but-narrow race window (e.g. warehouse marks it shipped one second before the customer's cancel request arrives) — this is a technical timing detail for the Technical PM/Architect stages to resolve against how the system actually tracks fulfillment state, not a further business decision.
