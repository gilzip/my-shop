# Business Requirement

## Business Problem

New customers have no extra incentive to complete their very first purchase. Once someone creates an account, there's nothing distinguishing their first order from any later one, even though a first purchase is the highest-risk moment for losing a potential long-term customer to a competitor.

## Business Objective

Increase first-purchase conversion among new customers by rewarding the first order specifically, turning a one-time visitor into someone who has actually transacted at least once.

## Target User

- **In scope**: customers making their first-ever order.
- **Explicitly not for**: customers who have already placed at least one order — the discount does not apply to repeat purchases, and existing customers should not be able to claim it again through any account action.

## Business Value

- First-purchase conversion is the highest-leverage point to influence — customers who complete one order are meaningfully more likely to return, so a modest first-order incentive can pay for itself.
- Low cost, contained exposure (limited to first orders only, not ongoing), and quick to test — deliberately chosen as the third of three small features validating the team's development process, exercising a different part of the system (promotions) than the previous two.

## Desired Capability

A new customer placing their first order receives a 10% discount automatically applied to that order — no code, coupon-hunting, or manual request required on the customer's part. Once they've completed that first order, later orders are priced normally with no further reference to this discount.

## Business Rules

- The discount is 10% and applies only to a customer's first order.
- "First order" means no prior completed order exists for that customer — and this explicitly includes guest checkouts: a guest order counts as a first order, and if that same person later orders again (as a guest with the same identity, or after registering), that later order does not qualify.
- The discount does not stack with itself across multiple orders — once a customer has one order (discounted or not, guest or registered), later orders don't qualify.
- No minimum order amount is required for this version — the discount applies to the first order regardless of its size, unless a future decision changes that.
- The discount applies automatically; it is not a code the customer has to enter (that would allow anyone to reuse it after seeing it once).

## Success Criteria

- A genuinely new customer's first order is priced 10% lower than it would otherwise be.
- The same customer's second order (and every order after) is priced normally, with no discount applied.
- A returning/existing customer's order is never discounted under this rule, regardless of how they reach checkout.

## Scope

- Automatic 10% discount, applied without a coupon code, restricted to a customer's first order only.

## Out of Scope

- Any coupon-code-based version of this discount (explicitly automatic, not code-driven, per the business rules above).
- Discounts for repeat customers, referrals, or any other segment — this is strictly a first-order incentive.
- Any expiration date or campaign window — this is intended as a standing new-customer policy, not a time-limited promotion, unless the business later says otherwise.

## Open Business Questions

None remaining — the one open question (whether guest checkout counts as a first order) has been resolved: yes, guest orders count. How "the same guest" is recognized across visits (e.g. by email address) so a repeat guest doesn't requalify is a technical detail for the Technical PM/Architect stages to resolve against the system's actual identity model, not a further business decision.
