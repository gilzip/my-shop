# Stories: Automatic 10% Discount on a Customer's First Order

## Story 1 — A genuinely new customer's first order is discounted automatically

**User story**
As a new customer placing my very first order, I want a 10% discount applied automatically, so I don't have to find or enter a coupon code to get it.

**Business context**
The core capability the business requirement asks for.

**Acceptance criteria**
- Given a customer (registered or guest) with no prior placed order, when they complete checkout, then the order total reflects a 10% discount, applied without any coupon code being entered.

**Business rules**
- No coupon code is involved at any point — the discount is automatic.
- No minimum order amount gates this discount, per the business requirement.

**Edge cases**
- An order still in progress (items being added, payment not yet arranged) should not itself count as a "prior order" that disqualifies a customer's real first completed order — only genuinely placed orders count.

**Dependencies**
None.

**Out of scope**
Any UI/wording beyond how discounts are already displayed generically at checkout.

**Relevant existing capability**
Vendure's built-in `order_percentage_discount` promotion action already applies a whole-order percentage discount; this story only needs a new eligibility condition, not a new discount mechanism.

---

## Story 2 — A customer's second (and later) order is never discounted under this rule

**User story**
As the business, I want this discount to apply strictly once per customer, so it stays a first-order incentive rather than becoming an ongoing discount.

**Business context**
Directly from the business requirement's business rules — the discount must not stack or repeat.

**Acceptance criteria**
- Given a customer who has already placed one order (discounted or not), when they place a second order, then this promotion does not apply to it, regardless of the second order's size or contents.

**Business rules**
- "Has already ordered" is determined by order history, not by account age, signup date, or any manual flag.

**Edge cases**
- A customer with an abandoned/incomplete first attempt (never actually placed) followed by a real completed order should have that completed order treated as their first — an abandoned cart must not count as "already ordered."

**Dependencies**
Story 1 (the condition must exist to verify what it excludes).

**Out of scope**
None beyond stated.

---

## Story 3 — A repeat guest (same email, no account) does not requalify

**User story**
As the business, I want a guest who checks out more than once with the same email to be recognized as the same person, so they can't repeatedly claim a "first order" discount by never creating an account.

**Business context**
Directly from the business decision that guest checkouts count as a first order — this story is what makes that decision safe rather than exploitable.

**Acceptance criteria**
- Given a guest who completed an order using a given email address, when that same email is used for a later guest checkout (with or without ever creating an account), then the later order does not receive this discount.

**Business rules**
- "The same person" for guest checkouts is determined by matching email address, consistent with how the system already treats guest identity elsewhere (not a new identity rule invented for this feature).

**Edge cases**
- A guest who later registers an account using the same email should still be recognized as having already ordered — registering an account must not "reset" their first-order eligibility.

**Dependencies**
Story 1, Story 2.

**Out of scope**
Any change to how guest checkout or account registration itself works — this story only consumes the existing email-matching identity behavior, it doesn't modify it.

---

## Story 4 — Existing promotion behavior is completely unaffected

**User story**
As the business, I want all previously working promotion logic to keep working exactly as before, so adding this discount doesn't quietly disable or change any other promotion capability.

**Business context**
Not customer-facing on its own, but a hard condition of this feature being safe to ship — the same category of risk discovery flagged for the shipping feature (config array replacement) applies here too, since promotion conditions are also registered as an array.

**Acceptance criteria**
- Given the new condition is registered, when any of Vendure's five built-in promotion conditions (minimum order amount, facet values, contains products, customer group, buy-X-get-Y) are used by another promotion, then they continue to function exactly as before.

**Business rules**
None beyond "no regression" — this story exists specifically to make that testable.

**Edge cases**
None beyond the acceptance criteria.

**Dependencies**
None, but should be verified alongside Stories 1-3 since all are affected by the same configuration change.

**Out of scope**
Any improvement to the existing built-in conditions themselves.
