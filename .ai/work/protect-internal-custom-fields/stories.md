# Stories: protect-internal-custom-fields

## Story 1: Hide the customer test fields from customers

**User story:** As the shop owner, I want customers to be unable to see or change `GilTest` and `dror_cust`, so that internal test data stays private and trustworthy.

**Business context:** Live introspection shows both fields in `CustomerCustomFields` (read) and in three write inputs: `UpdateCustomerCustomFieldsInput`, `RegisterCustomerCustomFieldsInput` and `CreateCustomerCustomFieldsInput`.

**Acceptance criteria**
- Given the Shop API, when its schema is introspected, then `GilTest` and `dror_cust` appear in no type.
- Given a signed-in customer, when they query `activeCustomer { customFields }`, then the result does not contain `GilTest` or `dror_cust`, even when the record has values for them.
- Given a signed-in customer, when they call `updateCustomer` with `customFields: { GilTest: 1 }`, then the request is rejected as invalid input and the stored value is unchanged.
- Given a new shopper, when they register or call `setCustomerForOrder` with either field, then the request is rejected and no value is stored from customer input.

**Business rules:** No Shop API path may read or write these fields.

**Edge cases**
- After this change, Customer has no public custom fields, so the Shop API types `customFields` as `JSON`. It must return `null`, not the full object.
- A guest checkout with no custom fields at all must keep working.

**Dependencies:** none. **Out of scope:** deleting or renaming the fields.
**Relevant existing capability:** `Customer.internalNote` is already hidden this way.

## Story 2: Hide the payment test field from customers

**User story:** As the shop owner, I want `gil_payment` hidden from customers' view of their payments.

**Business context:** Live introspection shows `PaymentCustomFields { gil_payment }` on the Shop API, which is reachable through `activeOrder.payments` and `orderByCode.payments`.

**Acceptance criteria**
- Given the Shop API, when its schema is introspected, then `gil_payment` appears in no type.
- Given a customer with a placed order whose payment has `gil_payment = 99999`, when they query the order's `payments { customFields }`, then the result does not contain `gil_payment`.
- Given a new payment created through checkout, when it is stored, then `gil_payment` still receives its default `99999`.

**Edge cases:** Payment will also be an all-hidden entity, so the `JSON` `null` behavior from Story 1 applies here too.
**Dependencies:** none.

## Story 3: Keep back-office access and existing data intact

**User story:** As a back-office staff member, I want to keep viewing and editing all five custom fields.

**Acceptance criteria**
- Given the Admin API, when its schema is introspected, then all five fields are present on their types and in the matching update inputs where they exist today.
- Given a staff member, when they edit `GilTest`, `dror_cust`, `Customer.internalNote` or `ProductVariant.internalNote` in the dashboard, then the change is saved.
- Given the database before and after the change, when the five columns are compared, then every value is identical and no migration was generated.

**Business rules:** No staff role loses access (stakeholder decision, 2026-10-21).

## Story 4: Regression – existing internal notes stay hidden, shopping still works

**Acceptance criteria**
- Given the Shop API, then `internalNote` appears in no type, as today.
- Given a shopper, when they browse, add to cart, check out with free shipping to Israel, and pay with simulated Apple Pay and with standard payment, then everything behaves as it did on 2026-10-21.
- Given the storefront at `:3001`, when a full checkout runs, then no GraphQL errors occur. The storefront does not reference these fields today.

## Story 5: "Internal by default" for future custom fields

**User story:** As the shop owner, I want any new custom field to be hidden from customers unless someone deliberately decides to expose it.

**Business context:** Vendure's default is the opposite (`public` defaults to `true`), and that default caused this leak three times.

**Acceptance criteria**
- Given a developer adds a custom field without stating whether customers may see it, when the change is built or started, then it is not exposed to customers, **or** it is flagged before it can ship. The Architect chooses which.
- Given a field that is meant for customers, then exposing it requires an explicit, visible declaration in the field's configuration.
- The rule is documented where future pipeline stages will read it (`.ai` docs and/or `AGENTS.md`).

**Out of scope:** changing Vendure itself.
