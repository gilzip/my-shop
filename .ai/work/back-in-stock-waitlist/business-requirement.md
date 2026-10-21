# Business Requirement

## Business Problem

When a product variant is out of stock, a shopper who wants it has nothing to do except leave and hope to remember to come back. Most never return, so the shop loses a sale it had already half-won. The shop also has no signal about how much unmet demand exists for items it cannot currently sell, so merchandisers restock and reorder without knowing which sold-out items people actually want.

## Business Objective

Turn "out of stock" from a dead end into a captured, measurable demand signal. Recover sales from shoppers who wanted an unavailable item, and give merchandisers evidence of unmet demand per variant to inform restocking.

## Target User

- **Shoppers (guests and registered customers)** who land on a variant that is currently out of stock and still want it.
- **Merchandisers / operations staff** who decide what to restock and need to see demand for unavailable items.

Not for: shoppers looking at items that are in stock (no change to their experience), and customers who want pre-orders or backorders (buying an item that is not yet available is a different capability).

## Business Value

- **Revenue recovery:** a notified shopper arrives with purchase intent already expressed.
- **Retention:** the shop is seen to act on the shopper's interest instead of ignoring it.
- **Better restocking decisions:** waitlist size per variant is direct evidence of unmet demand, not a guess from past sales.
- **Cost:** a single automatic notification replaces manual "let me know when it's back" requests to customer service.

## Desired Capability

- A shopper viewing an out-of-stock variant can ask to be told when it is available again, by giving an email address. A registered customer should not have to retype an email address they have already given the shop.
- The shopper gets clear confirmation that they are on the waitlist, and a clear, friendly response if they try to join a waitlist they are already on.
- When the variant becomes available again, each person waiting is told once that it is back, and is then no longer waiting. They are not notified repeatedly and not for the same restock twice.
- A merchandiser can see, for each variant, how many people are currently waiting for it.

## Business Rules

1. Only a variant that is currently out of stock can be waited for. An in-stock variant cannot be waitlisted, and the shopper is told to simply buy it.
2. The same email address can be on a given variant's waitlist only once. A repeat request is not an error for the shopper; they are told they are already on the list.
3. One shopper may wait for several different variants at the same time.
4. A person is notified **once** when the variant returns to stock, and is then removed from that waitlist. If the variant sells out again later, they must join again to be notified again.
5. Notification does not reserve stock or guarantee availability. If the variant sells out again before the shopper buys, that is expected and no compensation is owed.
6. The shop must only use the email address to tell the shopper about the variant they asked about. It must not be used for general marketing, and the shopper must be told this when they join.
7. An email address may be removed from a waitlist if the shopper asks, or if the variant is discontinued, without notifying anyone.
8. The waitlist count a merchandiser sees reflects only people still waiting, not people who have already been notified.

## Success Criteria

- A shopper can join the waitlist for an out-of-stock variant in a single short step.
- 100% of people waiting on a variant are notified within a reasonable time after it returns to stock, and none are notified twice for the same restock.
- No notification is sent for a variant that is not in stock.
- Merchandisers can read the current waiting count for any variant without asking anyone to run a report.
- Over time, a measurable share of notified shoppers go on to buy the item (the shop should be able to see this, even if the measurement itself is a later enhancement).

## Scope

- Joining a waitlist for an out-of-stock variant using an email address.
- Confirming to the shopper that they have joined, or that they were already on the list.
- Notifying each waiting person once when the variant is back in stock, then removing them from the waitlist.
- Showing merchandisers the number of people currently waiting per variant.

## Out of Scope

- Pre-orders and backorders (selling an item before stock exists).
- Reserving or holding stock for people on the waitlist.
- Prioritising waitlisted shoppers (for example, first come first served access to new stock).
- Notification channels other than email (SMS, push, in-app).
- Marketing use of waitlist email addresses.
- Reporting on conversion from notification to purchase (desirable later, not required now).
- Waitlists for entire products (as opposed to a specific variant).

## Open Business Questions

1. **Notification wording and branding:** who approves the content of the "it's back" message, and should it include any incentive?
2. **Waitlist expiry:** should someone who has waited a very long time (for example, a year) be removed automatically without being told?
3. **Waitlist size limit:** is there a maximum number of people per variant, and what happens when it is reached?
4. **Partial restock:** if stock returns but is far fewer units than people waiting, do we still notify everyone? (Working assumption: yes, notify everyone, because rule 5 already says availability is not guaranteed.)
5. **Merchandiser access:** which roles may see the waiting counts, and should they also see who is waiting or only how many? (Working assumption: counts only.)
6. **Consent and privacy review:** does legal need to review the notice shown when a shopper joins, given that a guest is giving an email address without creating an account?
