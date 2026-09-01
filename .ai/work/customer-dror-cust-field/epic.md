# Epic: Customer dror_cust Field

## Summary

Add a third customField to `Customer` (`dror_cust`, nullable text, no default) alongside the two already there (`GilTest`, `internalNote`), with no backfill — the simplest variant of this pipeline's recurring field-addition test.

## What "done" looks like

- `Customer.customFields.dror_cust` exists.
- Existing customers show no value for it.
- The two pre-existing Customer customFields are untouched.

## In Scope

One nullable text field, no default, no backfill.

## Out of Scope

Default value, backfill, customer-facing exposure, validation.

## Dependencies

None.
