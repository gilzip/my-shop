# Stories: Customer dror_cust Field

## Story 1 — The field exists and is inspectable

**Acceptance criteria**: given the field has been added, when a customer is viewed via the Admin API, then `dror_cust` is present and readable.

## Story 2 — No existing customer has a value

**Acceptance criteria**: given all customers that existed before the migration ran, when each is queried, then `dror_cust` is `null` for every one — no accidental default or backfill.

## Story 3 — The two pre-existing Customer customFields are unaffected

**Acceptance criteria**: given `GilTest` and `internalNote` already exist on Customer, when this feature's migration runs, then both continue to return their existing values unchanged for every customer.

**Business rules**: none beyond "no regression." **Dependencies**: none.
