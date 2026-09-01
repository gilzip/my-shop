# Business Requirement

## Business Problem

Warehouse and product staff currently have no place to record operational notes about a specific product variant (e.g. "fragile, handle with care", "discontinued next season", "check expiry before shipping"). This information today lives outside the system entirely (sticky notes, spreadsheets, verbal handoffs), so it gets lost between shifts and between the product and warehouse teams.

## Business Objective

Give staff a single, reliable place inside the admin system to record and see internal notes per variant, so operational knowledge about a specific variant travels with that variant instead of living in someone's head or an external file.

## Target User

- **In scope**: internal staff with admin access — product managers, warehouse/fulfillment staff, customer service agents who need context on a variant.
- **Explicitly not for**: storefront customers. This is not customer-facing information under any circumstance.

## Business Value

- Reduces operational errors caused by lost handoff knowledge (e.g. mishandling a fragile item, continuing to reorder a variant that's being discontinued).
- Low cost, low risk to deliver — a good first candidate to validate the team's development process end to end.

## Desired Capability

Any staff member with admin access can view and edit a free-text internal note attached to a specific product variant. The note is visible wherever staff already work with that variant in the admin system. It is never exposed through any customer-facing channel (storefront, order confirmation emails, receipts, customer-facing APIs).

## Business Rules

- The note is optional — a variant with no note is a normal, valid state.
- The note is plain internal text; no approval workflow, no notifications, no history of edits required for this first version.
- Visibility is restricted to admin/back-office access only. It must never appear anywhere a customer can see it.
- No length limit is business-critical for this version, but the field should hold at least a few sentences of free text.

## Success Criteria

- A staff member can add, edit, and view an internal note on any product variant without leaving their normal admin workflow.
- No internal note ever appears in any customer-facing surface.
- The feature ships as a small, self-contained change — a successful test of running one feature through the full team process end to end.

## Scope

- One free-text internal note field per product variant.
- Visible and editable by admin/back-office users only.

## Out of Scope

- Per-note history/audit trail of who changed what and when.
- Notifications or alerts tied to notes.
- Notes at any other level (product-level, order-level, customer-level) — this is variant-level only for now.
- Any customer-facing exposure of this data, in any form.

## Open Business Questions

None — the request is small and self-contained enough to proceed without further business clarification. If staff later want notes at other levels (product, order) or an audit trail, that should come back as a separate, explicit business request rather than being assumed here.
