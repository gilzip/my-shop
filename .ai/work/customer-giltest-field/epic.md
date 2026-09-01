# Epic: Customer GilTest Field

## Summary

Add a simple integer `customFields.Customer.GilTest` field and backfill it to `9999` on every existing customer, using the same customFields+migration mechanism as `variant-internal-note`, plus one new element: a data backfill of existing rows.

## Why now

An internal pipeline test, explicitly framed as such - validates that the pipeline can also handle a backfill of existing data, not just schema for new/future records.

## What "done" looks like in the context of this product

- `Customer.customFields.GilTest` exists (Admin API-visible at minimum).
- Every customer that existed before this change now has `GilTest = 9999`.

## In Scope

- One customField on Customer.
- A one-time backfill of existing rows to `9999`.

## Out of Scope

- Any default value or business logic applied to customers created after this change.
- Any customer-facing exposure.

## Dependencies

None.
