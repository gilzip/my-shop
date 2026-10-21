# Stories: Back-in-stock waitlist

Stories describe what must be true, not how it is built. The "out of stock" test everywhere below is the system's existing saleable-stock rule: a variant is out of stock when on hand minus allocated minus the out-of-stock threshold is zero or less, and a variant that does not track inventory is never out of stock.

---

## Story 1: Join the waitlist

**User story.** As a shopper looking at an out-of-stock variant, I want to give my email address so that I am told when it is available again.

**Business context.** Today a shopper facing a sold-out item has nowhere to go and the shop loses the sale. A registered customer should not retype an email address the shop already holds.

**Acceptance criteria.**

- **Given** a variant that is out of stock, **when** a shopper submits an email address for it, **then** the shopper is on that variant's waitlist and receives a clear confirmation that also says the address is used only for this one notice.
- **Given** an email already on that variant's waitlist, **when** the same email is submitted again, **then** the shopper is told they are already on the list, nothing is duplicated, and this is a normal outcome, not a failure.
- **Given** a variant that is in stock, **when** a shopper tries to join its waitlist, **then** nothing is stored and the shopper is told the item is available to buy now.
- **Given** a variant that does not exist, is disabled, or has been deleted, **when** a shopper tries to join, **then** nothing is stored and the response does not reveal anything about the shop's internal data.
- **Given** a registered, logged-in customer, **when** they join without typing an email, **then** the email on their account is used.
- **Given** an email address that is not a valid address, **when** submitted, **then** nothing is stored and the shopper is told the address is not valid.
- **Given** one email address, **when** it joins the waitlists of two different variants, **then** both entries exist independently.

**Business rules.** Only out-of-stock variants can be joined. One entry per email per variant. The address is used only for the notice about the variant requested.

**Edge cases.**
- Email case and surrounding spaces (`Ann@x.com` and `ann@x.com ` are the same person).
- Variant stock changes to saleable between the page loading and the join; the shopper is told it is in stock.
- Variant with a negative threshold (backorders allowed): it is saleable, so it cannot be joined.
- Very large numbers of joins from one source (abuse); the business has not set a limit.

**Dependencies.** Existing saleable-stock rule; a place to store waiting entries (new).

**Out of scope.** A storefront button or page; SMS or push; joining a whole product.

**Relevant existing capability.** The Shop API already tells a storefront whether a variant is out of stock (`ProductVariant.stockLevel`), so the "notify me" prompt can be shown without a new field. The `cancelMyOrder` feature already models "typed outcome, not an error" responses and guest versus registered handling.

---

## Story 2: Be notified once when the variant is back

**User story.** As a shopper on a waitlist, I want one message when the variant is available again so that I can buy it.

**Business context.** This is the point of the feature: it turns a missed sale into a returning visit.

**Acceptance criteria.**

- **Given** people waiting on a variant that is out of stock, **when** stock is added so the variant is saleable, **then** each waiting person receives exactly one email about that variant and is removed from its waitlist.
- **Given** the restock happens because an unfulfilled order is cancelled and its stock is released, **when** the variant becomes saleable, **then** the same notification happens.
- **Given** the restock happens because a fulfilled order is cancelled and its stock is restored, **when** the variant becomes saleable, **then** the same notification happens.
- **Given** a variant that is still out of stock after a stock movement (for example stock rises from -5 to 0 with a threshold of 0, or a further order is placed), **when** the movement occurs, **then** nobody is notified.
- **Given** a variant that was already in stock, **when** any stock movement occurs, **then** nobody is notified and no waitlist entry is affected.
- **Given** two stock movements in quick succession that both leave the variant saleable, **when** both are processed, **then** each waiting person still receives only one email.
- **Given** a variant is changed to stop tracking inventory, **when** it becomes always saleable, **then** its waiting people are notified.
- **Given** the email cannot be delivered, **when** the notification fails, **then** the person is not silently dropped without having been told. (Exact retry behaviour is for the Architect.)
- **Given** a notified person, **when** the variant sells out again later, **then** they are not on any list and must join again to be notified again.

**Business rules.** Notify once per person per join, then remove. Notification never reserves stock. Notify only when the variant is actually saleable by the system's own rule, not merely when stock changed.

**Edge cases.**
- Stock returns but is far fewer units than people waiting: everyone is still notified (working assumption from the requirement).
- The variant is disabled or deleted at the moment stock returns: no one is notified (the item cannot be bought), and the entries follow the removal rule in Story 4.
- Stock added directly in the database or by bulk import produces no stock event; this is a known gap, to be documented rather than hidden.
- A very long waitlist; sending must not block the stock change that triggered it.

**Dependencies.** Story 1 entries; the existing stock-change event; the email subsystem; a new email template.

**Out of scope.** Priority access for the first people on the list; any price offer in the email; reporting on who then bought.

**Relevant existing capability.** The system already announces every stock change (adjustment, release, cancellation, allocation) and already sends transactional email from events; the email cannot carry a working storefront link until a storefront URL exists in this project.

---

## Story 3: See how many people are waiting

**User story.** As a merchandiser, I want to see how many people are waiting for each variant so that I can decide what to restock.

**Business context.** Restocking decisions today are made without any demand signal for unavailable items.

**Acceptance criteria.**

- **Given** a variant with people waiting, **when** a merchandiser asks for its waiting count, **then** they get the number of people currently waiting.
- **Given** people who were already notified or have left the list, **when** the count is read, **then** they are not included.
- **Given** a variant with nobody waiting, **when** the count is read, **then** the answer is zero, not an error.
- **Given** a user without catalog permissions, **when** they ask for the count, **then** they are refused.
- **Given** a shopper using the storefront API, **when** they try to read the count or the list of who is waiting, **then** they cannot.
- **Given** the count, **when** it is shown, **then** it shows numbers only, not email addresses (working assumption from the requirement).

**Business rules.** Count reflects only people still waiting.

**Edge cases.**
- Reading counts for many variants at once (a listing screen) should not require one request per variant.
- A variant that no longer exists.

**Dependencies.** Story 1 entries.

**Out of scope.** A dashboard screen or chart (the count is delivered through the Admin API only), a "top demanded variants" report, conversion measurement.

**Relevant existing capability.** The Admin API already uses catalog permissions for variant data; the Admin Dashboard is a separate front end and is not extended here.

---

## Story 4: Leave the waitlist

**User story.** As a shopper, I want to remove my email from a waitlist so that I stop waiting for an item I no longer want.

**Business context.** The email is collected for one purpose; the shopper must be able to withdraw it. The shop must also not keep waiting people for variants that will never return.

**Acceptance criteria.**

- **Given** an email on a variant's waitlist, **when** the shopper asks to be removed, **then** the entry is deleted and no notification is sent.
- **Given** an email that is not on the list, **when** removal is requested, **then** the response is the same as for a successful removal so the shop does not reveal who is waiting.
- **Given** a variant that is deleted or discontinued, **when** it is removed from the catalog, **then** its waiting entries are removed without notifying anyone.
- **Given** a removed entry, **when** the variant later returns to stock, **then** that person is not notified.

**Business rules.** Removal never triggers a notice. The notification email itself should say how to stop receiving it (a link is not possible until a storefront exists, so the means of removal is an Architect decision).

**Edge cases.**
- Someone removing another person's email (guest identity is only the typed address). The risk is low (it only costs the other person a notification) but should be acknowledged.
- Removal at the same moment the variant returns to stock.

**Dependencies.** Story 1 entries.

**Out of scope.** Automatic expiry of old entries (open business question), bulk removal tools for staff.

**Relevant existing capability.** Core already emits an event when a variant is deleted, which is the natural moment to clear its entries.
