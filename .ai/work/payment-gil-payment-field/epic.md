# Epic: Payment gil_payment Field

## Summary

Add `customFields.Payment.gil_payment` (int, `defaultValue: 99999`), backfill the 4 existing rows via the migration's `UPDATE`, and rely on the confirmed database-level column default to cover every new Payment automatically with zero application-code changes to payment processing.

## Why now

Third field-addition pipeline test, chosen specifically because `Payment` is the first entity in this series with real, active business logic (payment processing) running through it — and because it exercises `defaultValue`'s actual runtime behavior for the first time, rather than just adding a nullable field.

## What "done" looks like in the context of this product

- `Payment.customFields.gil_payment` exists.
- All 4 pre-existing Payment rows show `99999`.
- A Payment created by a real checkout flow after this change also shows `99999`, without any change to payment processing code.

## In Scope

- One customField on Payment with a database-level default.
- Backfill of existing rows.

## Out of Scope

- Any influence on payment amount, state, or processing logic.

## Dependencies

None.
