# Business Requirement

## Business Problem

Merchandising staff currently have no way to encourage customers to add a complementary product to their cart by pairing it with a discount tied to buying a specific other product. Cross-sell opportunities (e.g. "buy the camera, get the memory card at a discount") go unaddressed today.

## Business Objective

Give the business a repeatable way to set up cross-sell promotions of the shape "buying product X makes product Y available at a discount," so merchandising staff can configure these on their own, per product pair, without needing a one-off engineering change every time they want a new pairing.

## Target User

- **In scope**: customers who purchase the qualifying product (X) and would also purchase or consider the paired product (Y).
- **Explicitly not for**: this is not a general-purpose discount engine — it addresses the specific "buy X, get Y at a discount" shape. Other promotion shapes the business already runs (or may want later) are separate concerns.
- **Also in scope, operationally**: merchandising/marketing staff who set up and manage these promotions.

## Business Value

- Increases average order value by encouraging an additional, related purchase.
- Lets the business run this kind of cross-sell promotion repeatedly, for different product pairs and discount amounts, without needing a new engineering change each time - the capability should be reusable, not a one-off for a single product pair.

## Desired Capability

Staff can set up a promotion specifying: a qualifying product (X), a paired product (Y), and a discount that applies to Y when both are in the customer's order. A customer who buys X sees Y become available at the discounted price as part of their order.

## Business Rules

- The discount applies to product Y only when the qualifying product X is also in the same order.
- The specific discount amount (percentage or fixed amount) and quantity conditions (e.g. does X need to be bought in a minimum quantity, does the discount apply to only one unit of Y or every unit) are per-promotion configuration, not fixed by this requirement - the requirement is for the capability to exist and be configurable, not for one specific numeric rule.
- If the qualifying product X is removed from the order, the discount on Y no longer applies.
- This does not guarantee Y is added to the cart automatically - the customer still has to add Y themselves to receive the discount on it, unless a future requirement says otherwise.

## Success Criteria

- Staff can configure a "buy X, get Y at a discount" promotion for a chosen product pair and discount amount without engineering involvement per new pairing.
- A customer with both X and Y in their order sees Y discounted according to the configured promotion.
- A customer with only Y (no X) in their order does not receive the discount.

## Scope

- The capability to configure a promotion of this shape (qualifying product, paired product, discount on the paired product) and have it apply correctly at checkout.

## Out of Scope

- Automatically adding product Y to the cart when X is purchased - the customer still chooses to buy Y themselves.
- Any other promotion shape (e.g. free shipping, whole-order percentage off, first-order discounts) - those are separate, already-existing or separately-scoped capabilities.
- A UI/flow for staff to configure promotions is assumed to already exist or be handled by whatever admin tooling the business already uses for promotions generally - this requirement is about the underlying capability existing, not about building new configuration UI.

## Open Business Questions

None remaining - the one open question (does the discount on Y apply once per order or scale per unit) has been resolved: it scales per unit. Every qualifying unit of Y in the order receives the discount, not just one, as long as the qualifying product X is present in the order.
