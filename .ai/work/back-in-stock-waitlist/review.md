# Review: Back-in-stock waitlist (cycle 1 of max 2)

Independent review. `implementation.md` and `schema-execution.md` were read last and not trusted: the plugin source, migration, template, config diff and tests were read directly, and everything below was re-run from scratch with new scripts (not the Developer's or any earlier scratchpad script).

## What I ran myself

| Check | Result |
|---|---|
| `npx tsc --noEmit` | passes |
| `npm test` | 15 of 15 pass (9 existing, 6 new `waitlist-rules`) |
| `vendure build server` | passes |
| Drift check (`migrate --generate RevDrift --output-dir <scratch>`) | "No changes in database schema were found"; 0 files written |
| `src/migrations` | 6 files |
| Scope (`git status`) | only the new plugin folder, the new template folder, the new test, the migration, `src/vendure-config.ts`, and the three living docs |
| Live suite `rev_waitlist.py` (server worker-less on :3000, real Admin and Shop APIs, assertions on the database and on the `job_record` queue) | **32 of 32 checks pass** |
| Extra race script `rev_race.py` | 8 parallel identical joins: one row, all answered "joined" (one new, the rest already on list); two concurrent restocks with 7 waiters: exactly one job per person |
| Real delivery: server stopped, worker run alone | all 62 queued `send-email` jobs completed (19 of them back-in-stock), none failed, no errors in the worker log |
| Cleanup | all 9 touched variants back to original stock, enabled, tracking and threshold; 0 leftover waitlist rows; test customers, the throwaway product, the test administrator and role removed; no app process left running |

## Checklist

**1. Business request satisfaction - met, with one gap (see Finding A).** A shopper can join for a sold-out variant by email; each waiter is notified exactly once and removed; merchandisers can read counts per variant. All verified live. The one gap is Rule 6: nothing at join time tells the shopper the address is used only for this one notice (the email says it, but only after the fact).

**2. Reuse of Vendure's extension points - met.** One `@VendurePlugin` with a TypeORM entity, Shop and Admin API extensions with `@Allow`, `EventBus.ofType` subscriptions, `EmailEventListener` plus template, and Vendure's own `ProductVariantService.getSaleableStockLevel` as the single in-stock rule. No second job queue, no parallel stock tracking, no `extend enum ErrorCode`. The EmailPlugin `handlers` array correctly spreads `defaultEmailHandlers`.

**3. Preservation of existing behaviour - met.** The default email handlers still work (the 25 previously pending jobs, including order-related emails, completed with the new handler list loaded). `cancelMyOrder` still behaves: anonymous cancel of a registered customer's order is `FORBIDDEN`, the owner's cancel succeeds. Placing and cancelling real orders on touched variants left stock correct. The only edit to existing source is three lines in `vendure-config.ts`.

**4. Coherent multi-step behaviour - met.** Join, wait, restock, claim, notify and clean-up fit together. Every restock route I could trigger was exercised and agreed with the same saleable rule (table below).

**5. Registration and configuration - met.** Plugin registered; entity registered through the plugin and matched by the migration (drift check clean); handler registered; template found at `static/email/templates/back-in-stock/body.hbs` and rendered correctly (variant name and SKU filled, no raw handlebars).

**6. Test coverage - adequate for this project, with a standing gap.** The committed automated tests cover only the pure rules (`waitlist-rules.ts`). Everything that matters behaviourally (join guards, the claim, the three event subscriptions, counts, clean-up) is covered only by live scripts that are not committed. This is the same gap as every earlier feature in this project; recommendation 4.

**7. Focused scope - met.** Nothing unrelated in the change. The living docs were updated by their owners (API map by the Architect, schema by the DBA, module map by the Technical PM).

**8. No unnecessary infrastructure - met.** One entity, one service, one pure-rules file, one event, one email handler. The design avoided a status column, a customer relation and a custom queue, and the code matches that.

## Live evidence by area

| Area | Verified live |
|---|---|
| Join | sold-out variant (guest); repeat join returns "already on list" with one row; padded and mixed-case address stored normalised and equal to its plain form; same address on two variants gives two rows; in-stock variant returns `VARIANT_IN_STOCK` and stores nothing; unknown id and disabled variant return the identical `VARIANT_NOT_FOUND`; invalid address; guest with no address returns `EMAIL_REQUIRED`; logged-in customer with no address uses the account email; a variant sold down by a real order can be joined |
| API surface | Shop API has no waitlist query and no entry type; admin counts correct (including zero); more than 500 ids rejected; anonymous and an administrator without `ReadCatalog` are refused |
| Restock routes | positive stock edit; order cancelled before fulfilment (RELEASE); fulfilled order cancelled (CANCELLATION; the line's movements were ALLOCATION, SALE, CANCELLATION); lowering the out-of-stock threshold (variant update, no stock movement); switching inventory tracking off; re-enabling a variant |
| Not notified | positive adjustment that leaves saleable stock at or below zero (rows kept, no job); restock while the variant is disabled (row kept); placing an order, which is an ALLOCATION (nothing triggered); a person who left |
| Exactly once | two back-to-back restocks, and two concurrent restocks with seven waiters: one job per person |
| Leave and delete | `leaveBackInStockWaitlist` returns true for present, repeated and unknown addresses and removes the row, sending nothing; deleting a product removes its rows with no email queued |
| Email | rendered file has subject "Skipping Rope is back in stock", the right recipient, says it is a one-time message and that the person is no longer on the waiting list, and contains **no product link** (the only link in the HTML is the header's Google Fonts stylesheet) |

## Acceptance criteria and business rules

**Story 1 (join):** met except the confirmation wording (Finding A). The "deleted variant" join case shares the code path of the unknown-id case (`findOne` excludes deleted variants) but was not joined live against a soft-deleted variant. A variant with a negative threshold (backorders allowed) was not exercised live.

**Story 2 (notify once):** met for every criterion I could trigger. **Not exercised live:** the "email cannot be delivered" criterion, that is, the failure path and the ERROR log from the `EmailSendEvent` subscriber (the design deliberately removes the row at claim and relies on the EmailPlugin's 5 retries; every send in this run succeeded). Also not exercised: a very long waitlist (tested with at most 7).

**Story 3 (counts):** met. **Story 4 (leave):** met; "removal at the same moment as a restock" not exercised.

**Business rules 1 to 8:** 1 (only out-of-stock variants), 2 (one entry per address, repeat not an error), 3 (several variants), 4 (notified once, then removed), 5 (no reservation, nothing in the code holds stock), 7 (removal on request and when a variant or product is deleted), 8 (count shows only people still waiting, by construction) verified. **Rule 6** (address used only for the notice; shopper told when they join) is half met: the email states it, nothing at join time does, and no code uses the address for anything else.

## Findings

No blocking defect was found. Open items, in order of importance:

**A. Join does not tell the shopper how the address will be used (Story 1 first criterion, Business Rule 6).** `WaitlistJoined` returns only `alreadyOnList`, so the confirming message and the "used only for this one notice" wording must be written by whoever builds the storefront. The wording is also an open business and legal question (requirement question 6), so the backend cannot invent it. Recommended: add an approved `notice: String!` to `WaitlistJoined` once legal approves the text, so the promise is made by the system and not by each storefront.

**B. Joining discloses whether an address is on a variant's list.** The repeat-join answer ("already on the list") is required by Rule 2, but it lets anyone probe whether a given address is waiting for a given variant. `leave` was designed not to disclose this and `join` partly undoes that. The business should confirm it accepts this trade-off; no code change is required if so.

**C. The duplicate-join recovery would fail on Postgres or MySQL.** `join` catches a unique-index error and re-queries inside the same transaction. On SQLite (this project) this works and was proven by the 8-way race. On Postgres a failed insert aborts the transaction, so the re-query would error. Not a problem today; when the database changes, replace it with an insert that ignores conflicts.

**D. Delivery-failure path is untested.** See Story 2 above. Accepted risk in the architecture.

## Open recommendations (none blocks)

1. Add the approved join notice to the API (Finding A).
2. Business decision on Finding B.
3. Keep the unique-index recovery portable before any database change (Finding C).
4. Commit the live suite (join, restock routes, exactly-once, clean-up) as a repeatable integration test, and add a test of the email failure path.
5. Still open from the Technical PM and Architect: address confirmation and rate limiting (anyone can enter any address), waitlist expiry and size limit, email copy approval, and a storefront URL for a product link.

## Verdict

```
PASS
```
