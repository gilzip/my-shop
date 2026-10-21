# Technical Discovery: order-gift-message

## Business requirement summary

The customer can add one optional gift message per order during checkout, and can edit or remove it until the order is placed. Staff see it on the order and can correct it until the order ships. The message is at most 200 characters of plain text, may contain line breaks, and keeps Hebrew, English, mixed text and emoji intact. It has no effect on price. Only the ordering customer and staff can see it. All three assumptions were accepted as written (200 characters; staff can edit until shipment; no content screening).

## Existing capability

- **Custom fields on Order** are supported by Vendure 3.7.2 (`CustomFields.Order`). This project has none yet: there are custom fields on `ProductVariant`, `Customer` and `Payment` only (`src/vendure-config.ts`).
- **Shop API `setOrderCustomFields(input: UpdateOrderInput)` already exists** (live introspection, server on :3000). It acts only on the session's **active** order (`shop-order.resolver.js:146-153`: `getActiveOrder`, otherwise `NoActiveOrderError`). An order stops being active when it is placed, so **the rule "the customer cannot change it after placement" holds already, with no new code.**
- **Admin API `setOrderCustomFields(input: UpdateOrderInput { id, customFields })` already exists** (`order.resolver.js:65-67`). It calls `OrderService.updateCustomFields` (`order.service.js:386-393`), which has **no order-state check**: staff can change the field in any state, including after shipment.
- `UpdateOrderInput.customFields` is typed `JSON` today in both APIs, because Order has no custom fields yet. Once one is added, the types will be generated.
- **Reading:**
  - Shop: `activeOrder` and `orderByCode` return the order's `customFields` for public fields. ~~`orderByCode` is limited to the order's owner (and a guest during the session that placed it).~~ **Corrected after review:** `DefaultOrderByCodeAccessStrategy` lets a logged-in user read only their own orders, but lets **any request that is not logged in** and holds the code read any order for 2 hours after placement. Business rule 7 was amended to accept this (see `review.md`, Finding A).
  - Admin: all fields are returned.

## Existing architecture relevant to this domain

- **Visibility convention** (`AGENTS.md`, `src/custom-fields/internal-by-default.ts`):
  - custom fields are customer-hidden by default, and a field without `public` also gets a Shop write guard;
  - **this is the first field customers must see and write**, so it needs an explicit `public: true` with the reason stated in its `description`.
- **String validation:**
  - Vendure checks only `pattern` for strings (`validate-custom-field-value.js`, `validateStringField`).
  - The `length` option sets the column size only, and SQLite does not enforce `varchar` length.
  - **So the 200-character limit needs a `validate` function.** It must count user-visible characters (code points), not UTF-16 units: `"🎂".length === 2`.
- **Line breaks:** custom field type `text` (a multi-line text area in the dashboard) suits this; `string` is single-line.

## Similar implementations

- Customer/Payment/ProductVariant custom fields: config entries in `vendure-config.ts` with label, description and a migration (see `customer-dror-cust-field`, `payment-gil-payment-field`).
- No existing custom field uses `validate`. `internalByDefault` wraps `validate` only for non-public fields, so it will **not** touch this field's `validate`.

## Existing business rules encoded in the system

- The active-order lifecycle: an order is editable by the customer only while it is active, before it is placed.
- Order states (`default-order-process`): shipment shows as `Shipped`, `PartiallyShipped` or `Delivered`.

## Relevant tests

- Unit tests: `test/*.test.ts` via `npm test` (node:test). Existing tests cover `internalByDefault` and the waitlist rules.
- No automated integration tests. Live E2E scripts exist in `.ai/work/*/e2e-*.mjs`.

## Reuse opportunities

- Shop and Admin `setOrderCustomFields`: no new API operation is needed.
- Custom field `validate` for length and plain-text rules.
- The `internalByDefault` convention, with an explicit `public: true`.
- The E2E pattern of `protect-internal-custom-fields/e2e-protect.mjs`.

## Required changes

1. A new Order custom field for the gift message: `public: true`, multi-line text, nullable, with a label and description.
2. A validation rule: at most 200 characters counted as code points; whitespace-only stored as empty; plain text.
3. A rule that stops staff edits once the order has shipped. This is **new**, since the framework allows edits in any state. The Architect chooses the mechanism.
4. A migration for the new column (DBA stage).
5. **Storefront:** today the storefront (`C:\vendure\storefront`, a separate repository) has no gift-message input or display, and no use of `customFields` at all. Without storefront changes, customers cannot use the feature from the UI; only the API would support it.

## New business behavior

Customers can set, change and clear a message on their active order. Staff see and edit it until shipment. Messages over 200 characters are refused with a clear error.

## Relevant files

- `src/vendure-config.ts` (`customFields`)
- `src/custom-fields/internal-by-default.ts` (convention; must leave `public: true` fields untouched)
- `src/migrations/` (new migration)
- `node_modules/@vendure/core/dist/api/resolvers/shop/shop-order.resolver.js:146-153`, `.../admin/order.resolver.js:65-67`, `.../service/services/order.service.js:386-393` (evidence)
- Storefront: `C:\vendure\storefront/src/features/checkout/` (checkout steps, order summary), `src/features/account/routes/orders/[code]/order-detail.tsx`

## Evidence from source

```js
// shop-order.resolver.js:146-153: Shop edits only the active order
async setOrderCustomFields(ctx, args) {
  if (ctx.authorizedAsOwnerOnly) {
    const sessionOrder = await this.activeOrderService.getActiveOrder(ctx, args[ACTIVE_ORDER_INPUT_FIELD_NAME]);
    if (sessionOrder) return this.orderService.updateCustomFields(ctx, sessionOrder.id, args.input.customFields);
  }
  return new NoActiveOrderError();
}
// order.service.js:386-393: no state check
async updateCustomFields(ctx, orderId, customFields) { let order = await this.getOrderOrThrow(ctx, orderId); order = patchEntity(order, { customFields }); ... }
```

## Open questions (for the Architect)

1. **Storefront scope:** should the storefront checkout input and the order display be part of this run, in the separate `C:\vendure\storefront` repository, or a follow-up? The success criteria assume a shopper uses the UI.
2. **Staff edit cutoff:** which mechanism blocks Admin edits once the order is `Shipped`, `PartiallyShipped` or `Delivered`? A field `validate` receives the value and the context, but not the order.
3. **Plain-text rule:** reject HTML-looking input, or store it as-is and rely on escaping when displaying?
