# Business Requirement

## Business Problem

None in the ordinary sense — this is a deliberate internal test, the same nature as the earlier `customer-giltest-field` feature, but this time on the `Payment` record and adding a "goes-forward default" behavior that the prior test didn't exercise. Framing it as a fictional business need would misrepresent it.

## Business Objective

Confirm the pipeline handles a schema addition + full-table backfill + an ongoing default-value behavior on `Payment` specifically, correctly and without disturbing real payment processing logic.

## Target User

- **In scope**: no end customer or business user is actually affected — this field is not customer-facing and carries no business meaning.
- **Explicitly not for**: not meant to reach any customer-facing surface, and not meant to influence payment processing/authorization/settlement logic in any way.

## Business Value

None in the ordinary sense — the value is in what running this teaches about the pipeline, specifically: adding a field to an entity with real, active business logic already running through it (`Payment`, unlike `Customer` or `ProductVariant`, sits directly in the checkout/payment lifecycle), while confirming a pure test field can be added there with zero effect on that lifecycle.

## Desired Capability

A new field, `gil_payment`, exists on the Payment record. Every Payment record that already exists in the system has this field's value backfilled to `99999`. Every Payment record created after this change also has this field set to `99999` by default, with no further action required.

## Business Rules

- Every existing Payment record, with no exceptions, ends up with `99999` in this field after the backfill.
- Every new Payment record going forward gets `99999` automatically, without the payment flow needing to set it explicitly.
- This field must not affect payment amount, state, authorization, settlement, or refund behavior in any way — it is inert data, not a control field.

## Success Criteria

- The field exists and is inspectable (e.g. via the Admin API/Dashboard) on any Payment record.
- Every existing Payment record shows `99999` for this field.
- A newly created Payment (from a real order going through checkout) also shows `99999` for this field, without any change to how checkout/payment itself behaves.

## Scope

- Adding one field to Payment.
- A one-time backfill of that field to `99999` for every Payment record that exists at the time the backfill runs.
- A default value of `99999` applied automatically to every new Payment record going forward.

## Out of Scope

- Any ongoing business meaning, validation rule, or influence on payment processing logic.
- Any customer-facing exposure.

## Open Business Questions

None — this is a fully specified internal test with no real ambiguity to resolve, following the same pattern already validated by `customer-giltest-field`.
