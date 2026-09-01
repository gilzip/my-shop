# Stories: Internal Note on Product Variant

## Story 1 — Staff can add and edit an internal note on a variant

**User story**
As an admin/back-office user, I want to write and edit a free-text internal note on a product variant, so operational knowledge about that variant (handling, discontinuation, etc.) travels with the variant instead of living outside the system.

**Business context**
This is the core capability the business requirement asks for — replacing sticky notes/verbal handoffs with a durable, per-variant note visible to whoever opens that variant in the admin system.

**Acceptance criteria**
- Given a product variant with no internal note, when a staff member opens it in the Dashboard, then the internal note field is present and empty.
- Given a staff member types text into the internal note field and saves, when the variant is reopened (by the same or a different staff member), then the saved text is shown.
- Given a staff member clears the note and saves, when the variant is reopened, then the note is empty (empty/no note is a valid state).

**Business rules**
- The note is optional; a variant with no note is normal and valid.
- No length restriction is business-critical, but the field must comfortably hold multi-sentence text.
- No approval workflow, no notifications, no edit history for this version.

**Edge cases**
- Very long note text should still save and display correctly (no silent truncation).
- A variant that already exists before this feature ships should show an empty note, not an error, the first time it's opened after the change.

**Dependencies**
None.

**Out of scope**
Edit history, notifications, per-note timestamps/authorship.

**Relevant existing capability**
The Dashboard's variant detail page already renders custom fields generically — no new UI is being built for this Story, only a new field definition.

---

## Story 2 — The note is never visible to customers

**User story**
As the business, I want to guarantee the internal note can never appear on the storefront or in any customer-facing output, so staff can write candidly without reviewing every note for customer-appropriateness.

**Business context**
This is the constraint that makes the field genuinely "internal" — directly from the business requirement's Target User and Business Rules sections.

**Acceptance criteria**
- Given the internal note field is configured, when the Shop API's schema is inspected, then no field for the internal note exists on `ProductVariant` in that schema (not merely inaccessible — structurally absent).
- Given a variant has a note set, when that variant is viewed through any storefront/customer-facing surface, then the note does not appear anywhere in the response.

**Business rules**
- Visibility is restricted to admin/back-office access only, with no exceptions.

**Edge cases**
- None specific to this story beyond the acceptance criteria above — this is a hard boundary, not a tunable permission.

**Dependencies**
Story 1 (the field must exist to verify it's correctly hidden).

**Out of scope**
Any customer-facing surface design — there is deliberately nothing to build here beyond configuring the field as admin-only.

**Relevant existing capability**
Vendure's own Shop-vs-Admin API schema generation already enforces this distinction based on the field's `public` setting — this story is about correctly configuring and verifying that existing mechanism, not building new access control.

---

## Story 3 — The schema change is captured as a real, applied migration

**User story**
As the team maintaining this system, I want the database change backing this feature captured as a committed migration, so the schema change is reproducible across environments and not dependent on an auto-sync that this project deliberately doesn't use.

**Business context**
Not a customer-facing story, but a condition of the feature being considered actually shipped rather than only working on one developer's machine.

**Acceptance criteria**
- Given the field is configured, when the migration is generated and run, then the underlying database column exists and the application starts successfully.
- Given the migration file, when it is inspected, then it contains both the forward (up) and reverse (down) schema change.

**Business rules**
None beyond what's already established (`synchronize: false` is a fixed project constraint, not a decision for this feature to revisit).

**Edge cases**
This is the first migration this project has ever had — the `src/migrations/` directory doesn't exist yet, so generating it is part of this story, not an assumption.

**Dependencies**
Story 1 (the field definition must exist before a migration can be generated for it).

**Out of scope**
Any broader migration tooling/process setup beyond what this one change requires.
