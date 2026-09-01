# Business Requirement

## Business Problem

None in the ordinary sense — this is a deliberate internal pipeline test, the same nature as the earlier `customer-giltest-field` and `payment-gil-payment-field` tests. Framing it as a fictional business need would misrepresent it.

## Business Objective

Confirm the pipeline continues to handle a simple, minimal schema addition correctly — no backfill, no default value, the plainest possible case in this series of tests.

## Target User

- **In scope**: no end customer or business user is actually affected — this field is not customer-facing and carries no business meaning.
- **Explicitly not for**: not meant to reach any customer-facing surface.

## Business Value

None in the ordinary sense — value is entirely in what running this confirms about the pipeline.

## Desired Capability

A new field, `dror_cust`, exists on the Customer record — a free-text field. No value is set for existing customers, and no default is applied to new ones; it simply exists, empty, until someone sets it.

## Business Rules

- No default value.
- No backfill of existing customer records — they remain unset for this field.
- No validation, no ongoing business meaning.

## Success Criteria

- The field exists and is inspectable (e.g. via the Admin API/Dashboard) on any Customer record.
- Existing customers show no value (empty/null) for this field.

## Scope

- Adding one nullable text field to Customer, with no default and no backfill.

## Out of Scope

- Any default value or backfill of existing rows.
- Any customer-facing exposure.
- Any validation or business logic tied to this field.

## Open Business Questions

None — fully specified, following the same pattern already validated by the prior two test fields.
