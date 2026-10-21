# Stories: order-gift-message

## Story 1: Add, change or remove a gift message at checkout

**User story:** As a gift buyer, I want to add a short personal message to my order while checking out, so that the recipient gets a personal note with the gift.

**Business context:** Vendure's Shop `setOrderCustomFields` already acts on the shopper's active order. This story adds the field it sets.

**Acceptance criteria**
- Given a shopper with items in the cart (signed in or guest), when they set the gift message to "Happy birthday!", then the active order shows that message.
- Given a message is set, when they set a different one, then the new message replaces it.
- Given a message is set, when they clear it (empty, or whitespace only), then the order has no message.
- Given the order is in `ArrangingPayment`, when they change the message, then the change is saved. Checkout is not finished yet.

**Business rules:** optional; one per order; free, so totals are unchanged.

**Edge cases:** setting a message with no active order returns the existing "no active order" error.

**Dependencies:** Story 2 rules.

## Story 2: Message rules

**Acceptance criteria**
- Given a message of exactly 200 characters, including Hebrew letters and emoji counted as one each, then it is accepted.
- Given a message of 201 characters, then it is refused with a clear error saying the limit is 200, and the previous value is unchanged.
- Given a message with line breaks, then the line breaks are kept.
- Given `"מזל טוב! Happy birthday 🎂"`, when it is read back in either API, then it is byte-for-byte identical.
- Given a whitespace-only message, then it is treated as no message.
- Given text that looks like HTML or a link, then it is handled as the Architect decides (refused, or stored and always shown as plain text), and it is never rendered as markup.

## Story 3: The customer sees the message after placing the order

**Acceptance criteria**
- Given a placed order with a message, when its owner views it (`orderByCode`, account order details), then the message is shown.
- Given a placed order, when the customer tries to change the message, then it is refused, because the order is no longer active, and the message is unchanged.
- Given another **signed-in** customer, then they cannot see someone else's message.
- Given someone who is not signed in and holds the order code, then they can see the message only within 2 hours of placement, the same as the rest of the order (business rule 7, amended 2026-10-21).

## Story 4: Staff see and correct the message until shipment

**Acceptance criteria**
- Given any order with a message, when staff open it in the dashboard, then the message is shown exactly as written.
- Given an order that has not shipped (for example `PaymentSettled`), when staff change the message, then the change is saved.
- Given an order in `Shipped`, `PartiallyShipped` or `Delivered`, when staff try to change it, then it is refused with a clear reason. This is **new behavior**: Vendure allows such edits today.
- Given staff without permission to update orders, then they cannot change the message. The existing order permissions apply.

## Story 5: Regression

**Acceptance criteria**
- Given an order without a message, then checkout, payments, shipping (including free shipping to Israel), promotions (first order, buy X get Y), order self-cancellation and the waitlist all behave as before.
- Given orders created before this feature, then they show no message and are otherwise unchanged.
- Given the message, then subtotal, shipping, tax and total are the same as without it.
- Given the existing internal custom fields, then they remain hidden from the Shop API.

## Story 6: Storefront (scope decided by the Architect)

**User story:** As a shopper on the storefront, I want a "gift message" box at checkout and to see my message in the order summary and my order details.

**Acceptance criteria (if in scope)**
- Given checkout, then an optional gift-message box is offered, with a live character count (up to 200).
- Given a message is entered, then it is shown in the order summary before placing the order, and in the order details afterwards.
- Given a Hebrew message, then it is displayed right-to-left correctly inside the English page.

**Dependencies:** `C:\vendure\storefront` is a separate repository, outside the isolated demo worktree.
