# Technical Discovery: Back-in-stock waitlist

## Business requirement summary

A shopper (guest or registered) can join a waitlist for a specific out-of-stock variant with an email address. When that variant is saleable again, every waiting person is notified once and removed from the list. Merchandisers can see how many people are waiting per variant. Rules that matter most: only out-of-stock variants can be joined; the same email joins a given variant once (a repeat is not an error); notification does not reserve stock; the email is used only for this one message; only people still waiting are counted.

## Existing capability

**Nothing waitlist-like exists.** No entity, API, plugin, email handler or template touches waiting for stock. The system does have the three ingredients the feature is built from:

1. A precise, existing definition of "saleable" (stock arithmetic, below).
2. An event fired on every stock change (`StockMovementEvent`).
3. An email subsystem that can send mail from any event.

## Existing architecture relevant to this feature

### What "out of stock" means in this system

`ProductVariantService.getSaleableStockLevel(ctx, variant)` (`node_modules/@vendure/core/dist/service/services/product-variant.service.js:263`):

```
if variant does not track inventory -> Number.MAX_SAFE_INTEGER   (never out of stock)
else stockOnHand - stockAllocated - effectiveOutOfStockThreshold
```

- `trackInventory` is a per-variant flag (`TRUE` / `FALSE` / `INHERIT`); `INHERIT` follows the global setting.
- `effectiveOutOfStockThreshold` is the global threshold if `useGlobalOutOfStockThreshold`, else the variant's own. A **negative** threshold means backorders are allowed.
- A variant is out of stock when the saleable level is `<= 0`. This is the rule the existing `addItemToOrder` uses to reject a purchase, so the waitlist must use the same one rather than invent its own.
- Stock is summed across stock locations by the configured `StockLocationStrategy` (`StockLevelService.getAvailableStock`).

Current data (read from `vendure.sqlite`): global `trackInventory = true`, global `outOfStockThreshold = 0`, one channel (`__default_channel__`), one stock location, 88 variants all set to `INHERIT`, every sampled variant has `stockOnHand = 100`. **No variant is out of stock today**, so a demo needs one variant's stock set to 0 first.

### What changes stock, and what announces it

Every change to saleable stock goes through `StockMovementService` and ends in `eventBus.publish(new StockMovementEvent(ctx, movements))`:

| Movement | Effect on saleable stock | Source (`stock-movement.service.js`) |
|---|---|---|
| `StockAdjustment` (manual edit, or `stockOnHand` set on variant create/update) | up or down | line 96 |
| `Allocation` (order placed) | down | line 142 |
| `Sale` (fulfilled) | none (allocated moves to sold) | line 182 |
| `Cancellation` (order cancelled after fulfilment) | up | line 222 |
| `Release` (order cancelled before fulfilment) | up | line 261 |

So stock can come back through **three** routes (adjustment, cancellation, release), not only the Admin "set stock" screen. Cancelled orders are a real source of restocks, including this project's own `cancelMyOrder`.

`StockMovementEvent` carries `stockMovements[]`, each with a `productVariant` reference and a signed `quantity`. It does **not** say whether the variant crossed from out of stock to in stock, so a listener must recompute saleable stock itself.

### Notifications

`@vendure/email-plugin` 3.7.2 is registered (`devMode: true`, templates in `static/email/templates/`, dev mailbox at `/mailbox`). An `EmailEventHandler` can listen to **any** `VendureEvent`, including a custom one: `.filter()`, `.setRecipient()`, `.setSubject()`, `.setFrom()`, `.setTemplateVars()`, `.loadData()` (`email-plugin/lib/src/handler/event-handler.d.ts`). Four stock templates exist (`order-confirmation`, `email-verification`, `password-reset`, `email-address-change`); there is no stock-alert template, so one is new. `globalTemplateVars` still point at the placeholder storefront `localhost:8080`, so a "view the product" link cannot be real yet.

### Where a new capability like this lives in this project

- Plugins live in `src/plugins/<name>/` and are registered in `src/vendure-config.ts`. The only existing one is `order-self-cancellation` (`.plugin.ts`, `.resolver.ts`, `shop-api-extensions.ts`).
- Schema changes go through migrations in `src/migrations/` (`synchronize: false`). Five exist, all customField additions. **A new entity would be the project's first.**
- Permission model: Shop API resolvers use `@Allow(Permission.Public)` / `Owner`; Admin queries use catalog permissions (`ReadCatalog`).
- Customer-facing fields default to hidden: `internalByDefault` wraps `customFields` so a field is Shop-API-hidden unless `public: true` is set. This applies to custom fields only; a new entity is not covered by it, so what the Shop API exposes about a waitlist entry must be decided deliberately.

## Similar implementations

| Existing | What it shows | Reuse |
|---|---|---|
| `OrderSelfCancellationPlugin` | First custom plugin: Shop API mutation, typed error results (`union ... = Order \| CancelMyOrderError`), a `@Transaction()` resolver, guest vs registered ownership handling | Plugin layout; typed-error pattern for "already on the list" and "variant is in stock"; guest/owner rules |
| Default email handlers | How an event becomes an email through templates | Pattern for the "it's back" email |
| `StockMovementEvent` (core) | Already published for every stock change | The trigger; no new hook into stock code is needed |

No existing feature stores a many-to-many "interest" record between a visitor and a variant.

## Existing business rules encoded in the system

- Saleable stock = on hand − allocated − threshold; variants that do not track inventory are always saleable.
- A guest holds nothing in this system except an order code; guests are `Customer` rows without a `user`. A guest has **no stable identity** apart from the email they type.
- Orders cancelled before fulfilment release stock automatically (`Release`), cancelled after fulfilment restore it (`Cancellation`).
- Event subscribers run **after** the transaction that raised the event commits, so a listener sees the committed stock level.

## Relevant tests

`test/internal-by-default.test.ts` is the only automated test (Node's built-in `node:test`, run with `npm test`). Everything else has been verified by live scripts against the running server. There is no test harness for services or the event bus; verification of this feature will again be live tests unless the Architect proposes otherwise.

## Reuse opportunities

1. **`getSaleableStockLevel`** as the single definition of in stock / out of stock, for both "can this be joined?" and "did it come back?".
2. **`StockMovementEvent`** as the only trigger.
3. **EmailPlugin** for the notice, via a new handler and template, on a custom event.
4. **The `order-self-cancellation` plugin layout and typed-error pattern.**
5. **Existing Shop API stock exposure** (`ProductVariant.stockLevel`) tells the storefront when to show the "notify me" prompt; no new field is needed for that.

## Required changes

| Area | Change | Kind |
|---|---|---|
| Persistence | Remember who waits for which variant, plus when they joined and whether they were notified | **New** (first custom entity, so first non-customField migration) |
| Shop API | Join a waitlist (variant + email) with typed outcomes: joined, already on the list, variant is in stock, variant not found | **New** |
| Admin API | Read the number of people waiting per variant | **New** |
| Stock watcher | On stock movement, find waiting people for the affected variants, recompute saleable stock, and notify those whose variant is saleable | **New** |
| Email | One new template plus handler for the "it's back" message | **New** (uses existing plugin) |
| Config | Register the new plugin | Small |
| Docs | `schema-overview.md` (DBA), `api-overview.md` (Architect), `modules-overview.md` (this stage) | Living docs |

## New business behaviour

- A new kind of record ties an email address to a variant.
- A new trigger: "variant became saleable" is detected from stock movements. It must tolerate the three restock routes and must not fire for variants that were never out of stock.
- A one-time notification with removal, and a count for merchandisers.

## Relevant files

- `node_modules/@vendure/core/dist/service/services/product-variant.service.js` (`getSaleableStockLevel`, line 263; stock set on create/update, lines 369 and 475)
- `node_modules/@vendure/core/dist/service/services/stock-movement.service.js` (event publish points, lines 96, 142, 182, 222, 261)
- `node_modules/@vendure/core/dist/service/services/stock-level.service.js` (`getAvailableStock`)
- `node_modules/@vendure/core/dist/event-bus/events/stock-movement-event.d.ts`
- `node_modules/@vendure/email-plugin/lib/src/handler/event-handler.d.ts`
- `src/vendure-config.ts` (plugin list, `EmailPlugin.init`, `customFields: internalByDefault(...)`)
- `src/plugins/order-self-cancellation/*` (reference plugin)
- `static/email/templates/*` (template conventions)
- `.ai/schema-overview.md`, `.ai/api-overview.md`, `.ai/modules-overview.md`

## Evidence from source

- Saleable formula and the "never out of stock when untracked" shortcut: `product-variant.service.js:263-275`.
- `StockMovementEvent` published after adjustments (96), allocations (142), sales (182), cancellations (222), releases (261).
- Restock via release and cancellation: `stock-movement.service.js:205-262` (`updateStockAllocatedForLocation(..., -qty)` and `updateStockOnHandForLocation(..., +qty)`).
- Variant create/update with `stockOnHand` goes through `adjustProductVariantStock` (`product-variant.service.js:369-372`, `475`), so it also emits the event.
- Data facts from `vendure.sqlite`: one channel, one stock location, 88 variants, all `INHERIT`, global threshold 0, no out-of-stock variant.
- `defaultEmailHandlers` cover only four events; none relate to stock.

## Open questions

1. **Event is not a crossing signal.** `StockMovementEvent` does not say "out of stock to in stock". The watcher will see every movement, including every order placement. How cheaply it can skip irrelevant movements (for example, only inspect variants that have a waiting person) is an Architect decision.
2. **Direct database or bulk edits** (CSV import, SQL) may change stock without a movement event. Treat as a known gap unless the business wants a safety net.
3. **Notification delivery failure.** If the email fails, is the person still removed? The business rule says "notified once"; the safe reading is not to remove someone who was never told. Needs a decision.
4. **Registered customers.** Should a logged-in customer's email be filled in automatically and linked to their account? The requirement says they should not retype it; whether the entry is also tied to the customer record affects privacy and data deletion.
5. **Race on "notify once".** Two stock movements in quick succession must not send two emails to the same person.
6. **Variants that stop tracking inventory** become permanently saleable. Treat as "back in stock" and notify.
7. **Channel awareness.** Only one channel exists, so scoping per channel is likely not needed now; confirm it is not a hidden requirement.
8. **Merchandiser access.** Which role reads the count, and does it appear on the Admin Dashboard UI or only through the API? The dashboard is a separate Vite app; extending it is a larger change.
9. **Storefront link.** The email cannot contain a working product link until a storefront URL exists.
10. **Business open questions** carried from the requirement (wording, expiry, size limit, privacy review) are still unresolved and are not decided here.
