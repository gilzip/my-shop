# Business Requirement

## Business Problem

Every customer sees the same set of shipping options and prices regardless of where they're shipping to or how much they're spending. There's no way today to reward larger domestic (Israel) orders with free shipping, which is a common incentive competitors already offer and customers increasingly expect.

## Business Objective

Increase average order value for Israeli customers by giving them a concrete incentive (free shipping) to cross a spending threshold, while keeping the cost of that incentive contained to the market and order size where it makes commercial sense.

## Target User

- **In scope**: customers whose order is shipping to an address in Israel.
- **Explicitly not for**: customers shipping outside Israel — they continue to see the existing shipping options and pricing, unaffected by this change.

## Business Value

- Encourages customers who are close to the threshold to add another item, increasing average order value.
- Matches a promotional lever competitors already use; closing this gap protects competitiveness without requiring a site-wide shipping price change.
- Low cost, low risk, and quick to test — deliberately chosen as the second of three small features used to validate the team's development process across different parts of the system.

## Desired Capability

When a customer is checking out with a shipping address in Israel and their order subtotal has reached the qualifying amount (200 ILS), free shipping appears as an available option at checkout, alongside (not necessarily replacing) any other shipping options they'd normally see. Customers below the threshold, or shipping elsewhere, see checkout behave exactly as it does today.

## Business Rules

- The qualifying amount is 200 ILS. If the business later wants a different threshold, that's a configuration change, not a new business requirement.
- Eligibility is based on the order subtotal reaching or exceeding the threshold — orders below it don't qualify.
- Eligibility is based on the shipping destination being Israel — no other country qualifies under this requirement.
- This does not remove or replace any existing shipping option; customers still see whatever other shipping choices they'd normally have.
- No time limit or promotional window is required for this version — the offer is a standing store policy, not a limited-time promotion.

## Success Criteria

- A qualifying Israeli order (destination Israel, subtotal ≥ 200 ILS) can be checked out with free shipping selected.
- A non-qualifying order (wrong destination, or subtotal below 200 ILS) never sees the free shipping option.
- No existing shipping behavior for any other order changes as a result of this feature.

## Scope

- One new shipping option, available only when both conditions (destination Israel, subtotal ≥ 200 ILS) are met.

## Out of Scope

- Free shipping for any other country or region.
- Any other qualifying condition beyond destination and order subtotal (e.g. specific products, customer tier, promotional codes).
- Changing or removing any existing shipping method.
- Any time-limited promotional aspect (start/end dates) — this is a standing rule, not a campaign.

## Open Business Questions

None — the threshold (200 ILS) and destination (Israel) were specified directly in the request and are concrete enough to proceed. If the business later wants the threshold to vary by customer segment or season, that should come back as a separate, explicit request.
