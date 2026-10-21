# Business Requirement

## Business Problem

Customers buying presents have no way to send a personal note with the order. Today a shopper who wants a "Happy birthday!" card in the box must contact the shop separately. Staff then have to match that request to the right order by hand, which is slow and easy to get wrong. Without a note, a gift arrives anonymous and impersonal, and customers may prefer a competitor that offers one.

## Business Objective

Customers can attach a short personal gift message to their order as part of checkout. Staff can see the message on that order and include it with the shipment, without any separate contact or manual matching.

## Target User

- **Primary:** shoppers buying a gift, signed in or checking out as a guest.
- **Secondary:** back-office and fulfilment staff, who read the message and include it in the package.
- **Not for:** messages to the shop itself (support requests, delivery instructions such as "leave at the door"). This is a note to the gift's recipient, not a channel to the shop.

## Business Value

- **Conversion and basket value:** gifting is a common reason to buy, and a personal note removes friction for gift buyers.
- **Customer experience and loyalty:** a personal touch at no extra cost differentiates the shop.
- **Operational cost:** no more manual matching of separately sent notes to orders.

## Desired Capability

- While checking out, a shopper can optionally write a short gift message, and can change or remove it at any point until the order is placed.
- The shopper sees their message in the order summary before confirming, and in their order details afterwards.
- Staff see the message clearly on the order, so it can be printed or handwritten into the package.
- Messages in Hebrew, in English, or in both together are shown exactly as written, including right-to-left text and emoji.

## Business Rules

1. **Optional.** An order without a message behaves exactly as today.
2. **Length:** at most **200 characters**. A longer message is refused with a clear explanation and is never cut silently.
3. **Content:** plain text only, with no formatting or links. Line breaks are allowed. Empty or whitespace-only text counts as "no message".
4. **Editable until the order is placed.** After that, the customer can no longer change it. Staff can correct it, for example on the customer's request, until the order ships.
5. **Free of charge.** The message never affects the price, tax, shipping or promotions.
6. **One message per order,** not per item.
7. **Visibility:** the customer who placed the order and back-office staff can see the message. As with the rest of the order details, anyone holding that order's confirmation code can also see it for 2 hours after the order is placed, so that guest buyers can view their confirmation. No other signed-in customer can see it. *(Amended 2026-10-21 by the stakeholder after review Finding A: option 1, accept the shop's existing order-code access.)*
8. **Languages:** Hebrew and English (and mixed text) must be stored and shown without loss or reordering.

## Success Criteria

- A shopper can add, change and remove a gift message during checkout, and sees it in the order summary and in their order details.
- Staff see the message on the order in the back office, exactly as written, in Hebrew and in English.
- A message of 201 or more characters is refused with a clear reason, and a message of exactly 200 is accepted.
- Orders without a message, and every existing checkout flow (payments, shipping, promotions), work exactly as before.
- No manual matching of gift notes to orders is needed for orders placed through the shop.

## Scope

- Adding, editing and removing one optional gift message per order during checkout.
- Showing it to the customer (summary and order details) and to staff (order view).
- Staff correcting the message before shipment.
- The length, content and language rules above.

## Out of Scope

- Printed gift cards, gift wrapping, or any paid gift option.
- Hiding prices or sending a "gift receipt".
- Sending the message to the recipient by email or SMS.
- Per-item messages, or several recipients per order.
- Automatic profanity or content moderation (see Open Business Questions).
- Translating messages.
- A separate shipping address for the gift recipient (already possible with the normal shipping address).

## Open Business Questions

All three assumptions below were accepted as written when the stakeholder approved this requirement on the SDLC dashboard (2026-10-21, no change requested).

1. **Is 200 characters the right limit?** Assumed yes: roughly a small card.
2. **Should staff be able to edit the message after the order is placed,** or only read it? Assumed: they can correct it until the order ships.
3. **Is any content screening required** (for example offensive words) before launch? Assumed: no automatic screening for now; staff use judgement when packing.
