# Stories: Payment gil_payment Field

## Story 1 — Every existing Payment is backfilled to 99999

**Acceptance criteria**: given all 4 Payment rows that existed before the migration, when each is queried, then `gil_payment` equals `99999` for every one.

**Dependencies**: none. **Out of scope**: behavior for payments created after the backfill (Story 2).

## Story 2 — A newly created Payment defaults to 99999 automatically

**User story**: as whoever verifies this pipeline test, I want a Payment created through a real checkout flow (not manually set) to already show `99999`, so the database-level default claim is proven live, not just asserted.

**Acceptance criteria**: given a new order that reaches a state where a Payment row is created, when that Payment is queried, then `gil_payment` equals `99999`, without any payment-processing code having explicitly set it.

**Business rules**: this must hold with zero changes to payment processing logic — the default must come from the database column itself.

**Dependencies**: Story 1 establishes the column exists; this story is the one that actually proves the "default value" half of the business requirement, which Story 1 alone does not cover.

## Story 3 — Payment processing itself is completely unaffected

**Acceptance criteria**: given the new field exists, when a payment is authorized/settled/refunded through the existing dummy/simulated handlers, then it behaves exactly as before - same states, same amounts, no new errors.

**Business rules**: none beyond "no regression." **Dependencies**: none, verify alongside Story 2.
