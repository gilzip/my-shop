# Epic: Back-in-stock waitlist

## Summary

Let shoppers ask to be told when an out-of-stock variant is saleable again, tell each of them exactly once when it is, and give merchandisers a live count of unmet demand per variant.

## Why this fits the existing product

The shop already has a strict, single definition of "saleable" (on hand minus allocated minus the out-of-stock threshold, with untracked variants always saleable), and it already announces every stock change on an internal event. What it lacks is any memory of who wanted an item it could not sell. This Epic adds that memory and a one-time notification, and deliberately reuses the existing definition and event rather than creating a second notion of "in stock".

Stock returns to a variant through three different routes in this system: a manual stock edit (or setting stock on a variant), a released allocation when an unfulfilled order is cancelled, and a restored unit when a fulfilled order is cancelled. The shop's own customer self-cancellation feature is one such route. The waitlist must work for all three, not only the Admin "set stock" screen.

## Outcomes

- A shopper facing a sold-out variant has a way to say "tell me when it is back" in one short step, as a guest or a registered customer.
- Everyone who asked is told once, promptly, when the variant is saleable, and then leaves the list.
- Merchandisers can read how many people are waiting for each variant.
- Nobody is told about a variant that is not actually saleable, and nobody is told twice for the same restock.

## Stories

1. **Join the waitlist** - a shopper adds an email to an out-of-stock variant, with clear outcomes for success, already on the list, and variant in stock.
2. **Be notified once when the variant is back** - the stock watcher recognises a restock from any route and sends one email per waiting person, then removes them.
3. **See how many people are waiting** - merchandisers read the current count per variant.
4. **Leave the waitlist** - a shopper or the shop removes an email without anyone being notified.

## In scope

Waitlist for a specific variant by email; confirmation and duplicate handling; one-time email on restock; per-variant waiting count for staff; removal on request or when a variant is discontinued.

## Out of scope

Pre-orders and backorders, reserving stock for waiting people, prioritising waiting people, channels other than email, marketing use of the addresses, conversion reporting, product-level waitlists, a storefront UI, and extending the Admin Dashboard screens (the count is delivered through the Admin API).

## Constraints and risks

- Stock can change without an event if someone edits the database or runs a bulk import directly; that case is a known gap.
- The email cannot contain a working product link yet because no storefront URL exists in this repository.
- This will be the project's first custom database entity, so it carries the first non-customField migration and a living-docs update by the DBA.
- A notified shopper may find the item gone again; the business has accepted this (no reservation).

## Dependencies

EmailPlugin (already registered), `StockMovementEvent` and `getSaleableStockLevel` from core, the existing plugin conventions in `src/plugins/`.

## Open questions for the Architect and business

Carried from `technical-discovery.md`: delivery-failure handling, linking entries to customer accounts, double-notification races, waitlist expiry and size limit, merchandiser role and UI.
