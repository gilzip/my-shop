# Business Requirement

## Business Problem

The shop keeps a few extra data fields on customer records and on payments that exist only for internal purposes: two test fields on the customer record (GilTest, dror_cust) and one test field on payments (gil_payment). An end-to-end test on 2026-10-21 showed that customers can see the two customer test fields through the storefront and can change their values on their own account. The payment test field is probably visible to customers as well.

Customers should never see internal data, and they should never be able to change data the business relies on. Today, any customer can overwrite internal values on their own record, and the business cannot trust those values.

## Business Objective

Every internal or test data field is invisible to customers and cannot be changed by them. Back-office staff keep the same full access they have today.

## Target User

- **Protected from:** shoppers using the storefront, whether they are signed in or checking out as a guest.
- **Unaffected:** back-office staff, who keep full ability to view and edit these fields in the admin dashboard.
- **Not targeted:** customer-facing fields that exist to serve the customer. None exist today, but this requirement must not block them in the future.

## Business Value

- **Risk / data integrity:** internal values can no longer be tampered with by customers, so reports or decisions based on them stay trustworthy.
- **Privacy / professionalism:** customers no longer see internal or test data that has no meaning to them.
- **Consistency:** the rule already applied to internal notes ("internal-only, never shown to customers") is applied to every internal field.

## Desired Capability

- A shopper viewing or editing their own account sees and changes only customer-facing information. Internal and test fields are not visible and cannot be submitted.
- A shopper's view of their orders and payments shows no internal or test payment data.
- A back-office staff member sees and edits all of these fields exactly as today.

## Business Rules

1. Every data field that is internal or test-only must be hidden from customers and must not be changeable by customers. This applies to the customer record, payments, and any other customer-visible record.
2. This applies to: GilTest (customer), dror_cust (customer), gil_payment (payment).
3. Fields that are already internal-only must stay internal-only: the internal note on product variants and the internal note on customers.
4. Back-office staff access to all of these fields must not be reduced.
5. Existing stored values must be kept. This requirement changes who can see and change the data, not the data itself.
6. From now on, any new internal-only field must be internal-only by default. Making a field visible to customers must be a deliberate, stated decision.

## Success Criteria

- A signed-in customer cannot read GilTest, dror_cust or gil_payment, and cannot change GilTest or dror_cust (gil_payment is never customer-editable).
- A repeat of the 2026-10-21 end-to-end test finds no internal or test fields exposed to customers.
- Back-office staff can still view and edit all five fields (GilTest, dror_cust, gil_payment, and both internal notes) in the admin dashboard.
- No existing value in any of these fields is lost or changed.
- Normal storefront shopping is unaffected: browsing, cart, checkout, payment, and order history.

## Scope

- Hiding and protecting GilTest, dror_cust and gil_payment from customers.
- Confirming that the two internal notes remain hidden.
- Recording the "internal by default" rule for future fields.

## Out of Scope

- Deleting or renaming any of these fields, or clearing their values. Whether the test fields should exist at all is a separate decision. In particular, this does not resume or close the stopped GilTest feature.
- Changing what back-office staff can see or do, including any finer-grained staff permission levels.
- Admin login hardening, such as the default administrator password. This is a related finding but a separate request.
- Any change to the storefront's look or flows.

## Open Business Questions

None. Both questions below were resolved by the business stakeholder on 2026-10-21:

- ~~Should GilTest, dror_cust and gil_payment be removed entirely?~~ **No.** The test fields stay; this requirement only hides them from customers.
- ~~Is any staff role meant to be restricted from these fields?~~ **No.** All staff keep today's full access.
