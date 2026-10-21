# Implementation: Back-in-stock waitlist

Implemented exactly as `architecture.md` scoped. **No correction to the architecture was needed.**

## Files changed

Created (all inside the new plugin unless stated):

- `src/plugins/back-in-stock-waitlist/back-in-stock-waitlist.plugin.ts` - plugin class; registers the entity, service, both API extensions, and three event subscriptions (`StockMovementEvent`, `ProductVariantEvent` for updated and deleted, `EmailSendEvent` for failure logging). Every subscriber catches and logs, because a throw would end the subscription.
- `waitlist-entry.entity.ts` - `WaitlistEntry` (`productVariantId`, `emailAddress`, unique index on the pair; no foreign key, no status column).
- `waitlist.service.ts` - `join`, `leave`, `counts`, `notifyIfSaleable`, `clearForVariants`.
- `waitlist-rules.ts` - pure helpers (`normaliseEmail`, `isValidEmail`, `restockCandidateVariantIds`), free of Vendure imports so they can be unit-tested.
- `back-in-stock.event.ts` - `BackInStockEvent`.
- `back-in-stock-email-handler.ts` - `EmailEventListener('back-in-stock')`, tagged with metadata so a failed send can be recognised.
- `shop-api-extensions.ts`, `admin-api-extensions.ts`, `shop.resolver.ts`, `admin.resolver.ts` - the API (see below).
- `static/email/templates/back-in-stock/body.hbs` - the notice, using the existing header and footer partials. No product link (no storefront URL exists).
- `test/waitlist-rules.test.ts` - 6 unit tests.

Modified:

- `src/vendure-config.ts` - imports; `BackInStockWaitlistPlugin` added to `plugins`; EmailPlugin `handlers: defaultEmailHandlers` became `[...defaultEmailHandlers, backInStockEmailHandler]` (spread, because the array is replaced, not merged). Nothing else in the file changed.

No migration file was written. The schema change belongs to the DBA stage.

## Behaviour implemented

- **`joinBackInStockWaitlist(productVariantId, emailAddress?)`** (Shop, public). Order of checks: resolve the address (argument, else the logged-in customer's account email, else `EMAIL_REQUIRED`); normalise and validate (`INVALID_EMAIL`); load the variant through the channel-aware `ProductVariantService.findOne` (missing, deleted and disabled all return `VARIANT_NOT_FOUND`); if `getSaleableStockLevel > 0`, return `VARIANT_IN_STOCK`; then insert. A repeat join, including a lost race against the unique index, returns `WaitlistJoined { alreadyOnList: true }`. All guards run before the one write.
- **`leaveBackInStockWaitlist`** (Shop, public) deletes the row and always returns `true`. It sends nothing.
- **`backInStockWaitlistCounts(productVariantIds)`** (Admin, `ReadCatalog`). One `GROUP BY`; variants nobody waits for return 0; more than 500 ids is rejected.
- **Restock detection.** `StockMovementEvent`: ALLOCATION and SALE are ignored, a non-positive ADJUSTMENT is ignored, everything else is a candidate. `ProductVariantEvent('updated')`: every variant in the event is a candidate (covers enabling a variant and turning inventory tracking off, which emit no stock movement). For candidates, one query loads their waiters and stops if there are none. Otherwise each variant is reloaded, skipped if disabled or deleted, and checked with `getSaleableStockLevel`.
- **Notify once.** For a saleable variant, each waiter is claimed with `DELETE ... WHERE id = ?`; only a claim with `affected === 1` publishes `BackInStockEvent`, so two concurrent watchers cannot both send.
- **Clean-up.** `ProductVariantEvent('deleted')` (which product deletion also triggers) removes that variant's rows without notifying anyone.
- **Failure logging.** A failed send tagged by our metadata is logged at ERROR with the variant id and the error, never the address.

## Tests run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | passes, no output |
| `npm test` (`node:test`) | **15 / 15 pass**: the 9 existing `internal-by-default` tests plus 6 new `waitlist-rules` tests (email normalisation, valid/invalid addresses, ALLOCATION and SALE never a restock, negative and zero adjustment never a restock, positive adjustment / cancellation / release / unknown type are candidates, de-duplication across string and number ids) |
| `vendure build server` | passes; the plugin compiled to `dist/` |
| Boot smoke test (`node dist/index.js`, port 3000, stopped afterwards) | server starts with the plugin loaded; Shop API introspection shows **35 mutations** including `joinBackInStockWaitlist` and `leaveBackInStockWaitlist`; Admin API shows **83 queries** including `backInStockWaitlistCounts`; the Shop API has **no** waitlist query; `WaitlistError` implements `ErrorResult` and `ErrorCode` gains `WAITLIST_ERROR` automatically. These match the counts written into `api-overview.md` |
| Schema drift as reported by Vendure at boot | Vendure listed exactly `CREATE TABLE "waitlist_entry"` (`emailAddress varchar NOT NULL`, `productVariantId integer NOT NULL`, timestamps) and `CREATE UNIQUE INDEX` on `(productVariantId, emailAddress)` as pending, i.e. the entity produces the table the architecture describes |
| `git status` scope check | Only: the new plugin folder, the new template folder, the new test, `src/vendure-config.ts`, and the two living docs. Nothing unrelated |

## What was NOT tested yet, and why

The table does not exist until the DBA stage generates and runs the migration, and the Developer stage was told not to run it. Therefore **no behaviour that touches the database has been exercised**: joining, duplicate handling, the three restock routes, claim-and-notify, counts, and clean-up on deletion. These are the live tests listed in `architecture.md` and belong to the Reviewer, after the DBA stage. The unit tests cover only the pure rules.

## Known limitations

- **No live end-to-end test yet** (above). Until the migration runs, calling the new Shop mutations would fail on the missing table.
- **Real emails need the worker process.** Without it the `send-email` job is queued but never sent.
- **A permanent email failure loses one notice** (row removed on claim; EmailPlugin retries 5 times, then it is logged). Accepted in the architecture.
- **No stock event for direct database edits or bulk import**, so those cannot trigger notices.
- **No address confirmation and no rate limit**: anyone can submit any address. Flagged to the business in the architecture.
- **Deleting a customer does not delete their waitlist rows** (email-only identity, by design).
- **Email wording is placeholder copy** pending business approval, and carries no product link.
- **Only automated test coverage is the pure rules.** Same standing gap as the previous features: there is no service-level test harness in this project.
