# Epic: Gift message on orders

## Context

Gift buyers in my-shop cannot add a personal note to their order; today the request has to come through a separate channel and be matched to the order by hand. Vendure already lets an order carry extra fields, and has operations for the customer (on the order still being built at checkout) and for staff (on any order) to set them. my-shop has no order-level field yet, and since 2026-10-21 every custom field is hidden from customers unless explicitly exposed. This will be the first field customers deliberately see and write.

## Goal

One optional gift message per order:
- written by the customer during checkout, and editable until the order is placed;
- shown to the customer in the order summary and the order details;
- shown to staff on the order, and editable by staff until the order ships;
- at most 200 characters of plain text, with Hebrew, English, mixed text and emoji preserved exactly.

## Stories

1. A customer adds, changes or removes a gift message on their order during checkout
2. Message rules: length, plain text, empty handling, languages
3. A customer sees their gift message on the order after placing it, and can no longer change it
4. Staff see and correct the gift message until the order ships
5. Existing checkout and orders are unaffected
6. Storefront: gift message input at checkout and display in the order views (scope set by the Architect)

## Success measures

- All Given/When/Then criteria in `stories.md` pass in a live run.
- The 2026-10-21 regression suite still passes.
- The message never changes order totals.

## Out of scope

Printed or paid gift options, gift receipts, sending the message to the recipient, per-item messages, content moderation, translation, and a separate recipient address.
