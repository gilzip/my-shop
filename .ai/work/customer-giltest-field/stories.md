# Stories: Customer GilTest Field

## Story 1 — The field exists and is inspectable

**User story**
As whoever is verifying this pipeline test, I want to see the `GilTest` field on a Customer record through a normal admin-facing tool, so I can confirm the change actually took effect.

**Business context**
Directly from the business requirement's success criteria.

**Acceptance criteria**
- Given the field has been added, when a customer is viewed via the Admin API or Dashboard, then `GilTest` is present and readable.

**Business rules**
None beyond existence.

**Edge cases**
None.

**Dependencies**
None.

**Out of scope**
Any specific UI placement/styling.

---

## Story 2 — Every existing customer is backfilled to 9999

**User story**
As whoever is verifying this pipeline test, I want every customer that existed before this change to show `9999` for `GilTest`, so the backfill step is verifiably complete, not partial.

**Business context**
Directly from the business requirement - this is the one genuinely new mechanic this feature exercises (a data backfill, not just a schema addition).

**Acceptance criteria**
- Given all customers that existed before the migration ran, when each is queried, then `GilTest` equals `9999` for every one of them, with no exceptions.

**Business rules**
- No customer is skipped or excluded.

**Edge cases**
- A soft-deleted customer (`deletedAt` set) should still be backfilled too, unless the Architect determines there's a good reason to exclude them - the business requirement says "every existing customer" without carving out an exception, so absence of an exception should be treated as intentional, not an oversight to silently fix.

**Dependencies**
Story 1 is not a prerequisite for this one technically, but verifying this story requires the field to exist first.

**Out of scope**
Any behavior for customers created after the backfill runs.
