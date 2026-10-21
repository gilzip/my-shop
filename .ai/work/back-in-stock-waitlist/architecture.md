# Architecture: Back-in-stock waitlist

## Verified architecture

Everything below was checked in the installed source (`@vendure/core` 3.7.2, `@vendure/email-plugin` 3.7.2), not taken from the PM documents.

| Claim | Verified | Evidence |
|---|---|---|
| "Out of stock" is `onHand - allocated - threshold <= 0`, and untracked variants are always saleable | Yes | `product-variant.service.js:263-275` (`getSaleableStockLevel`) |
| Every stock change publishes `StockMovementEvent` | Yes | `stock-movement.service.js` lines 96 (adjustment), 142 (allocation), 182 (sale), 222 (cancellation), 261 (release) |
| Stock can rise only via ADJUSTMENT (positive), CANCELLATION, RELEASE | Yes, with a correction | The enum also lists `RETURN`, but 3.7.2 never creates one (no `Return` entity, no code path). The design therefore ignores only ALLOCATION and SALE and treats every other type as a *candidate*, then re-verifies with the saleable formula |
| `eventBus.ofType()` subscribers run **after** the publishing transaction commits | Yes | `event-bus.js:94` pipes through `awaitActiveTransactions`; its JSDoc says subscribers "can safely access all updated" data |
| Setting `stockOnHand` on a variant update also emits the movement event | Yes | `product-variant.service.js:369-372, 475` call `adjustProductVariantStock` |
| **Changing `trackInventory` or enabling a variant emits no stock movement** | Yes - a gap in the PM story | Those edits publish only `ProductVariantEvent('updated')` (`product-variant.service.js:327`). Story 2's "stops tracking inventory" case is invisible to a stock-only listener, so the watcher must also listen to variant updates |
| Deleting a product also emits a variant deletion event | Yes | `product.service.js:softDelete` calls `productVariantService.softDelete`, which publishes `ProductVariantEvent('deleted')` (`product-variant.service.js:604`) |
| Job queues are consumed **only by the worker process** | Yes | `JobQueueService.start()` is called from `worker/vendure-worker.js:21`; the server does not start queues |
| EmailPlugin sends through its own `send-email` job queue with `retries: 5` | Yes | `email-plugin/lib/src/plugin.js:335, 394` |
| EmailPlugin publishes `EmailSendEvent` per attempt, with `setMetadata()` data attached | Yes | `email-processor.js:69, 79`; `types.d.ts` (`SetMetadataFn`, since 3.1.0) |
| A custom `VendureEvent` can drive an email through `EmailEventListener` | Yes | `handler/event-handler.d.ts` (`filter`, `setRecipient`, `setTemplateVars`, `setMetadata`) |
| `Permission.ReadCatalog` exists | Yes | `common/lib/generated-types.d.ts:4197` |
| No existing Shop/Admin operation covers waitlists | Yes | `.ai/api-overview.md` lists none; the Shop API exposes only `ProductVariant.stockLevel` for display |

### Consequences that change the design versus the PM documents

1. **The watcher listens to two events, not one.** `StockMovementEvent` (restock routes) **and** `ProductVariantEvent('updated')` (enabling a variant, turning off inventory tracking). `ProductVariantEvent('deleted')` is a third, used only for clean-up.
2. **We do not add our own job queue.** Sending already goes through EmailPlugin's queue with 5 retries. A second queue would add a worker dependency and nothing else.
3. **Real emails need the worker process.** A worker-less server stops at the `job_record` row for the `send-email` job. Live tests must either run server and worker together, or assert on the queued job.

## Proposed design

A single custom plugin, `BackInStockWaitlistPlugin`, following the layout of `order-self-cancellation`. It owns one entity, one service, a Shop API extension, an Admin API extension, two event subscriptions and one email handler.

### Data: `WaitlistEntry` (table `waitlist_entry`, the project's first custom entity)

| Column | Type | Notes |
|---|---|---|
| `id`, `createdAt`, `updatedAt` | from `VendureEntity` | |
| `productVariantId` | `@EntityId()` | Plain id column, **no foreign key**. Variant deletion in Vendure is soft, so a cascade would never fire; cleanup is done by event (below) |
| `emailAddress` | `varchar`, stored trimmed and lower-cased | |

Constraints: unique index on `(productVariantId, emailAddress)` (backs Rule 2, makes joins idempotent); the leading column also serves the lookups "who waits for variant X" and "how many wait for X".

There is **no status column and no row for a notified person**. A row means "still waiting". This makes Rule 8 (count only people still waiting) true by construction and keeps stored email addresses to the minimum the privacy rule allows (Rule 6).

### Decisions on the open questions

| Question | Decision | Why |
|---|---|---|
| Double notification race | Claim each row with `DELETE ... WHERE id = ?` and send only if `affected === 1` | A single atomic statement per row; two concurrent watchers cannot both win. No locks or extra tables |
| Delivery failure | Delete at claim time; EmailPlugin retries 5 times; a subscriber on `EmailSendEvent` logs an ERROR (variant id, no address) for failures tagged by our metadata | "Notify once" is the hard rule. A permanent failure loses one non-reserving notice, which is low cost; the alternative (a NOTIFYING state with recovery) adds a status machine for a rare case. Recorded as an accepted risk |
| Linking to customer accounts | **No link.** Store the email only. A logged-in customer who omits the address gets their account email resolved at join time | Keeps guests and customers identical and avoids a data-deletion trail through the customer record. Accepted limitation: deleting a customer does not delete their waitlist rows |
| Removal mechanism | Shop mutation `leaveBackInStockWaitlist`. No unsubscribe link is needed in the email, because the notified person has **already been removed** by the time the email arrives | Resolves the "how do they stop" question without a storefront URL |
| Merchandiser access | Admin API query guarded by `Permission.ReadCatalog`, **numbers only**, no addresses | Matches the working assumption. No Dashboard screen (separate Vite app, out of scope) |
| Business open questions (expiry, size limit, wording, legal text) | **Not decided here** | The business owns them. No expiry job, no size cap are built; the email text is placeholder copy pending approval |

### Join rules (service `WaitlistService.join`)

1. Resolve the address: use the argument if given; otherwise, for a logged-in customer, the account email; otherwise `EMAIL_REQUIRED`.
2. Normalise (trim, lower-case) and validate with a simple address pattern, else `INVALID_EMAIL`.
3. Load the variant through `ProductVariantService.findOne(ctx, id)` (channel-aware, excludes soft-deleted). Missing, deleted or `enabled = false` returns `VARIANT_NOT_FOUND`, the same answer for all three (no leak).
4. Compute `getSaleableStockLevel`. If `> 0`, return `VARIANT_IN_STOCK`; store nothing.
5. Insert; a unique-violation or pre-existing row yields success with `alreadyOnList: true`.

### Restock detection (the watcher)

One function, `notifyIfSaleable(ctx, variantIds)`, called from two subscriptions:

| Subscription | Filter before doing any work |
|---|---|
| `eventBus.ofType(StockMovementEvent)` | keep movements whose type is not `ALLOCATION` or `SALE`, and for `ADJUSTMENT` only `quantity > 0`; take distinct `productVariant.id` |
| `eventBus.ofType(ProductVariantEvent)` with `type === 'updated'` | all variants in the event |

`notifyIfSaleable`:
1. One indexed query: which of these variant ids have any entries? If none, **return** (this is what keeps the cost near zero for ordinary traffic, since allocations/sales never reach it and most variants have no waiters).
2. For each such variant, load it, skip if deleted or disabled, compute `getSaleableStockLevel`; skip if `<= 0`.
3. For each entry of a saleable variant: claim (atomic delete); if won, `eventBus.publish(new BackInStockEvent(ctx, variant, emailAddress))`.

The subscriptions run after commit, so they see the final stock level, and they run outside the stock-changing request, so a long list cannot slow the order or the Admin save that triggered it.

A third subscription, `ProductVariantEvent` with `type === 'deleted'`, deletes the entries for those variants without notifying anyone (Story 4).

### Notification

- `BackInStockEvent extends VendureEvent` carrying `ctx`, the variant and the address.
- An `EmailEventListener('back-in-stock')` handler: recipient = address, sender = `{{ fromAddress }}`, subject = "`<variant name>` is back in stock", template vars = variant name and SKU, `setMetadata` tags the send so the failure logger can recognise it.
- New template `static/email/templates/back-in-stock/body.hbs` using the existing `partials/header` and `footer`. It states: this is a one-time message, the address is used only for this notice, you are no longer on the list, and availability is not guaranteed. **No product link** (no storefront URL exists in this repository; flagged to the business).

### API

**Shop API** (two new mutations; Shop goes from 33 to 35)

```graphql
extend type Mutation {
  joinBackInStockWaitlist(productVariantId: ID!, emailAddress: String): JoinBackInStockWaitlistResult!
  leaveBackInStockWaitlist(productVariantId: ID!, emailAddress: String!): Boolean!
}
union JoinBackInStockWaitlistResult = WaitlistJoined | WaitlistError
type WaitlistJoined { alreadyOnList: Boolean! }
enum WaitlistErrorReason { VARIANT_IN_STOCK VARIANT_NOT_FOUND INVALID_EMAIL EMAIL_REQUIRED }
type WaitlistError implements ErrorResult { errorCode: ErrorCode! message: String! reason: WaitlistErrorReason! }
```

- Both are `@Allow(Permission.Public)`.
- `leave` always returns `true`, whether or not the address was on the list (no disclosure of who is waiting). It never emails anyone.
- **Do not** `extend enum ErrorCode`: Vendure generates it from `ErrorResult` implementers, and extending it manually stopped the server booting last time (see `order-self-cancellation`). The union needs a `@ResolveField('__resolveType')` resolver, as `cancelMyOrder` has.

**Admin API** (one new query; Admin goes from 82 to 83 queries)

```graphql
extend type Query {
  backInStockWaitlistCounts(productVariantIds: [ID!]!): [BackInStockWaitlistCount!]!
}
type BackInStockWaitlistCount { productVariantId: ID! waiting: Int! }
```

- `@Allow(Permission.ReadCatalog)`; one `GROUP BY` query for all ids; ids with no rows return `waiting: 0`; input limited to 500 ids.
- Not on the Shop API, so a shopper cannot read counts or addresses.

### Why no `customFields`, no `internalByDefault` concern

The waitlist is a new entity, not a custom field, so `internalByDefault` does not apply. The equivalent rule is applied by hand: the Shop API exposes only the two mutations above and **no query** that reads entries.

## Files to create

```
src/plugins/back-in-stock-waitlist/
  back-in-stock-waitlist.plugin.ts      plugin class: entity, providers, API extensions, the three event subscriptions
  waitlist-entry.entity.ts              WaitlistEntry
  waitlist.service.ts                   join, leave, counts, notifyIfSaleable, clearForVariants
  waitlist-rules.ts                     pure helpers: normaliseEmail, isValidEmail, restockCandidateVariantIds(movements)
  back-in-stock.event.ts                BackInStockEvent
  back-in-stock-email-handler.ts        EmailEventListener + failure logger
  shop-api-extensions.ts
  admin-api-extensions.ts
  shop.resolver.ts                      join / leave + __resolveType resolver
  admin.resolver.ts                     counts
static/email/templates/back-in-stock/body.hbs
test/waitlist-rules.test.ts
src/migrations/<timestamp>-AddWaitlistEntry.ts      (generated by the DBA stage, not hand-written)
```

## Files to modify

- `src/vendure-config.ts`: add `BackInStockWaitlistPlugin` to `plugins`; in `EmailPlugin.init`, change `handlers: defaultEmailHandlers` to `handlers: [...defaultEmailHandlers, backInStockEmailHandler]` (the array is replaced, not merged, so the defaults must be spread, the same lesson as `shippingOptions` and `promotionOptions`).
- `.ai/api-overview.md` (Architect-owned): updated now, see below.
- `.ai/schema-overview.md`: left to the DBA stage after the migration runs.

## Registration and configuration

1. Plugin in `plugins` with `entities: [WaitlistEntry]` so TypeORM sees it.
2. Email handler added to the `handlers` array.
3. `synchronize` stays `false`; the table arrives only through the generated migration. After the Developer writes the entity, the DBA runs `vendure migrate --generate AddWaitlistEntry` then `--run`, and verifies with the drift check.

## Frontend / storefront implications

There is no storefront in this repository. A storefront would show the "notify me" prompt when `ProductVariant.stockLevel` is `OUT_OF_STOCK` and call `joinBackInStockWaitlist`. The email contains no link until a storefront URL exists.

## Tests to add

| Kind | What |
|---|---|
| Automated (`npm test`, `node:test`) | `waitlist-rules.ts` only: email normalisation and validation; which movement types and signs count as restock candidates (ALLOCATION and SALE never, negative ADJUSTMENT never, positive ADJUSTMENT / CANCELLATION / RELEASE and unknown types yes) |
| Live, against the running server (worker running, or assert on the queued `send-email` job) | join a sold-out variant; join twice (`alreadyOnList`); join an in-stock variant (`VARIANT_IN_STOCK`); join a missing / disabled variant (same error); invalid email; logged-in customer joins without an address; same address on two variants |
| Live: each restock route | positive stock edit; unfulfilled order cancelled (Release); fulfilled order cancelled (Cancellation); `trackInventory` switched to off; variant enabled again |
| Live: negatives | movement that leaves stock at or below zero notifies nobody; sale or allocation notifies nobody; in-stock variant movement touches no rows |
| Live: once only | two restocks in quick succession send one email; a notified person is gone from the list; counts exclude notified people |
| Live: admin | count with and without `ReadCatalog`; Shop API has no count query; Shop schema introspection shows no entry-reading field |
| Live: clean-up | deleting a product removes its entries without sending mail |
| Regression | `cancelMyOrder` still passes; `npm run build` and `tsc --noEmit` pass; drift check reports no schema change after the migration |

A demo needs one variant's stock set to 0 first: all 88 variants currently hold 100 units.

## Risks

1. **Lost notice on permanent email failure** (accepted, logged). Upgrade path: a NOTIFYING status with a retry sweep.
2. **No stock event for direct database edits or bulk import.** Documented gap. A safety-net sweep is a possible later job, not built.
3. **First custom entity**: the first non-customField migration, and SQLite table rebuilds are rewrite-heavy, so the DBA must verify the generated migration before running it.
4. **Abuse**: anyone can submit any address, so the shop could be used to send one unsolicited email to a third party per variant. Mitigations in the business rules (a single, plain, one-time message). A rate limit and an address confirmation step are **not built** and are flagged for the business.
5. **Privacy**: addresses of customers who are later deleted remain until notified. Flagged for the legal review the business already listed.
6. **Worker dependency**: without the worker no email leaves the system. Same as every other email in this project today.
7. **Stampede**: a large restock on a variant with many waiters publishes many events in a row. They are queued by EmailPlugin, but the loop itself is sequential; acceptable at current scale.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Listen to `StockMovementEvent` only | Misses enabling a variant and turning off inventory tracking, both of which make it saleable with no stock movement |
| Poll all waiting variants on a schedule (`DefaultSchedulerPlugin`) | Delays the notice, scans without cause, and duplicates the event the system already publishes |
| A `status` column (WAITING / NOTIFIED) | Keeps addresses forever against the privacy rule and forces every count and watcher query to filter by it |
| Add a `waitlist` relation to `Customer` / link to account | Guests have no account; two identity models for one feature; leaves a deletion trail |
| `customFields` on `ProductVariant` (for example a JSON list of emails) | Concurrent joins would overwrite each other, no unique constraint, addresses exposed wherever the variant is read |
| Our own JobQueue for notifications | EmailPlugin already queues with retries; a second queue adds a worker dependency and no benefit |
| Foreign key with `ON DELETE CASCADE` to `product_variant` | Variants are soft-deleted, so the cascade never fires; the event-based clean-up is the real mechanism |
| `extend enum ErrorCode` | Breaks server boot, proven by `order-self-cancellation` |
| Shop query returning the waitlist or counts | Would let shoppers read who else is waiting |
| Dashboard (Vite) screen for counts | A second front end to build and test for a number that the Admin API can already deliver; out of scope per the Epic |
