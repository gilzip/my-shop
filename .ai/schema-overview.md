# Database Schema Overview — my-shop (Vendure 3.7.2)

Living reference of the actual database schema for this project. Maintained by the **DBA** stage of the DevSDLC pipeline — updated every time a feature's `schema-execution.md` changes the schema, so this file should always reflect what's really in the database, not just what was originally scaffolded.

## Status as of 2026-10-21 (updated after `back-in-stock-waitlist`)

- **DB engine**: `better-sqlite3` (SQLite), file at `vendure.sqlite`, configured in `src/vendure-config.ts` (`dbConnectionOptions`).
- **Migrations**: `synchronize: false`. `src/migrations/` contains six applied migrations (see Custom additions below).
- **Custom entities**: one - `WaitlistEntry` (table `waitlist_entry`), the first, added by `src/plugins/back-in-stock-waitlist/`. The other custom plugin, `order-self-cancellation`, adds no table.
- **customFields**: five fields so far — `ProductVariant.internalNote`, `Customer.GilTest`, `Customer.internalNote`, `Payment.gil_payment`, `Customer.dror_cust` (see Custom additions below).
- **Registered plugins**: GraphiqlPlugin, AssetServerPlugin, DefaultSchedulerPlugin, DefaultJobQueuePlugin, DefaultSearchPlugin, EmailPlugin, DashboardPlugin — all stock/official, none add project-specific tables.
- **Conclusion**: the schema is otherwise **100% stock `@vendure/core` 3.7.2**, with five custom fields and one custom table added via the pipeline below. No indexes were added for the five custom fields — none of their access patterns call for one. The one index that exists is the unique index on `waitlist_entry`.

---

## Catalog & Assets

| Entity | Key fields | Relations |
|---|---|---|
| **Product** | id, name/slug/description, enabled, deletedAt | `featuredAsset`→Asset (M:1); `assets`→ProductAsset[] (1:M); `variants`→ProductVariant[] (1:M); `optionGroups`→ProductOptionGroup[] (1:M); `facetValues`↔FacetValue (M:M); `channels`↔Channel (M:M) |
| **ProductVariant** | id, name, sku, enabled, deletedAt, trackInventory, *customFields.internalNote (admin-only, see Custom additions)* | `product`→Product (M:1); `featuredAsset`→Asset (M:1); `assets`→ProductVariantAsset[] (1:M); `taxCategory`→TaxCategory (M:1); `productVariantPrices`→ProductVariantPrice[] (1:M); `stockLevels`→StockLevel[] (1:M); `stockMovements`→StockMovement[] (1:M); `options`↔ProductOption (M:M); `facetValues`↔FacetValue (M:M); `collections`↔Collection (M:M); `channels`↔Channel (M:M); `lines`→OrderLine[] (1:M) |
| **ProductVariantPrice** | price, channelId, currencyCode | `variant`→ProductVariant (M:1) — per-channel price row |
| **ProductOption** | id, name, code, deletedAt | `group`→ProductOptionGroup (M:1); `productVariants`↔ProductVariant (M:M); `channels`↔Channel (M:M) |
| **ProductOptionGroup** | id, name, code, deletedAt | `options`→ProductOption[] (1:M); `products`↔Product (M:M); `channels`↔Channel (M:M) |
| **Collection** | id, name/slug/description, isRoot, isPrivate, position | `featuredAsset`→Asset (M:1); `assets`→CollectionAsset[] (1:M); `productVariants`↔ProductVariant (M:M) — **not** linked to Product directly; `parent`/`children`→Collection (self, tree); `channels`↔Channel (M:M) |
| **Facet** | id, name, code, isPrivate | `values`→FacetValue[] (1:M); `channels`↔Channel (M:M) |
| **FacetValue** | id, name, code | `facet`→Facet (M:1); `channels`↔Channel (M:M); `products`↔Product (M:M); `productVariants`↔ProductVariant (M:M) |
| **Asset** | id, name, type, mimeType, width/height, fileSize, source, preview | `tags`↔Tag (M:M); `channels`↔Channel (M:M); reverse of every `featuredAsset` FK |
| **ProductAsset / ProductVariantAsset / CollectionAsset** | assetId, position | each extends abstract `OrderableAsset`; ordered join entities to Asset (M:1) plus their owning entity (M:1) — Vendure's pattern for ordered asset lists instead of a plain M:M |

## Orders, Customers, Payments

| Entity | Key fields | Relations |
|---|---|---|
| **Order** | id, code, state, active, orderPlacedAt, currencyCode, type, totals | `customer`→Customer (M:1, optional); `lines`→OrderLine[] (1:M); `surcharges`→Surcharge[] (1:M); `promotions`↔Promotion (M:M); `payments`→Payment[] (1:M); `fulfillments`↔Fulfillment (**M:M** — multivendor split support); `shippingLines`→ShippingLine[] (1:M); `channels`↔Channel (M:M); `modifications`→OrderModification[] (1:M); `aggregateOrder`→Order (self, M:1, for split seller orders) |
| **OrderLine** | id, quantity, listPrice, listPriceIncludesTax | `productVariant`→ProductVariant (M:1); `taxCategory`→TaxCategory (M:1); `order`→Order (M:1); `shippingLine`→ShippingLine (M:1, optional); `sellerChannel`→Channel (M:1, optional); `sales`/`cancellations`/`allocations`→StockMovement subtypes |
| **OrderModification** | note, priceChange | `order`→Order (M:1); `lines`→OrderModificationLine[] (1:M); `payment`→Payment (M:1, optional); `refund`→Refund (M:1, optional) |
| **Customer** | id, title, firstName, lastName, phoneNumber, emailAddress, deletedAt | `groups`↔CustomerGroup (M:M); `addresses`→Address[] (1:M); `orders`→Order[] (1:M); `user`→User (M:1/1:1, optional — guests have none); `channels`↔Channel (M:M) |
| **CustomerGroup** | name | `customers`↔Customer (M:M); `taxRates`→TaxRate[] (1:M) |
| **Address** | fullName, company, streetLine1/2, city, province, postalCode, phoneNumber, default flags | `customer`→Customer (M:1); `country`→Country (M:1) |
| **Payment** | method, amount, state, errorMessage, transactionId, *customFields.gil_payment (see Custom additions)* | `order`→Order (M:1); `refunds`→Refund[] (1:M) |
| **PaymentMethod** | name, code, description, enabled | `channels`↔Channel (M:M) — linked to `Payment` only by matching `Payment.method` string to `PaymentMethod.code`, **not** an FK |
| **Refund** | total, method, reason, state | `payment`→Payment (M:1); `lines`→RefundLine[] (1:M) |
| **Fulfillment** | state, trackingCode, method, handlerCode | `lines`→FulfillmentLine[] (1:M); `orders`↔Order (**M:M**) |

## Shipping & Stock

| Entity | Key fields | Relations |
|---|---|---|
| **ShippingLine** | listPrice, adjustments, taxLines | `shippingMethod`→ShippingMethod (M:1, nullable); `order`→Order (M:1); `orderLines`→OrderLine[] (1:M) |
| **ShippingMethod** | code, name, description, fulfillmentHandlerCode, deletedAt | `channels`↔Channel (M:M) |
| **StockLocation** | name, description | `channels`↔Channel (M:M); `stockMovements`→StockMovement[] (1:M) |
| **StockLevel** | stockOnHand, stockAllocated | `productVariant`→ProductVariant (M:1); `stockLocation`→StockLocation (M:1) — composite join between the two |
| **StockMovement** (abstract; subtypes Allocation, Cancellation, Release, Sale, StockAdjustment) | type, quantity | `productVariant`→ProductVariant (M:1); `stockLocation`→StockLocation (M:1) |

## Channel, Region, Tax, Promotion, Seller

| Entity | Key fields | Relations |
|---|---|---|
| **Channel** | code, token, defaultLanguageCode, defaultCurrencyCode, pricesIncludeTax | `seller`→Seller (M:1, optional); `defaultTaxZone`/`defaultShippingZone`→Zone (M:1); reverse M:M side of nearly every other entity (products, variants, facets, collections, promotions, paymentMethods, shippingMethods, customers, roles, stockLocations); `apiKeys`→ApiKey[] (1:M) |
| **Zone** | name | `members`↔Region (M:M — Countries/Provinces); `taxRates`→TaxRate[] (1:M) |
| **Region** (abstract; Country, Province) | code, type, name, enabled | `parent`→Region (self, M:1 — Province's parent Country) |
| **TaxCategory** | name, isDefault | `productVariants`→ProductVariant[] (1:M); `taxRates`→TaxRate[] (1:M) |
| **TaxRate** | name, enabled, value | `category`→TaxCategory (M:1); `zone`→Zone (M:1); `customerGroup`→CustomerGroup (M:1, optional) |
| **Promotion** | name, couponCode, startsAt/endsAt, usageLimit, enabled | `channels`↔Channel (M:M); `orders`↔Order (M:M) |
| **Seller** | name, deletedAt | `channels`→Channel[] (1:M, reverse of `Channel.seller`) |

## Identity

| Entity | Key fields | Relations |
|---|---|---|
| **User** | identifier, verified, lastLogin, deletedAt | `authenticationMethods`→AuthenticationMethod[] (1:M); `roles`↔Role (M:M); `sessions`→AuthenticatedSession[] (1:M) |
| **Role** | code, description, permissions | `channels`↔Channel (M:M) |
| **Administrator** | firstName, lastName, emailAddress, deletedAt | `user`→User (M:1/1:1) |
| **Session** (abstract; AuthenticatedSession, AnonymousSession) | token, expires, invalidated | `activeOrder`→Order (M:1, nullable); `activeChannel`→Channel (M:1, nullable); AuthenticatedSession adds `user`→User (M:1) |

## Notable non-obvious relations

- **Collection links to ProductVariant, not Product** — there's no direct Product↔Collection relation.
- **Order↔Fulfillment is many-to-many**, not one-to-many, to support multivendor split orders.
- **PaymentMethod↔Payment is not a foreign key** — it's a string-code match (`Payment.method` = `PaymentMethod.code`).
- Ordered asset lists (Product/ProductVariant/Collection → Asset) go through join entities extending `OrderableAsset`, not a plain M:M.

## Custom additions

| Table | Column | Type | Nullable | Public (Shop API) | Introduced by |
|---|---|---|---|---|---|
| `product_variant` | `customFieldsInternalnote` (config name: `internalNote`) | `TEXT` | yes | no — absent from Shop API schema entirely | [`variant-internal-note/schema-execution.md`](work/variant-internal-note/schema-execution.md) |
| `customer` | `customFieldsGiltest` (config name: `GilTest`) | `INTEGER` | yes | **yes — currently exposed to Shop API** (config is missing `public: false`; this is a documentation gap being closed retroactively here, not a new finding — see Note below) | `.ai/work/customer-giltest-field/` (undocumented in this file until now) |
| `customer` | `customFieldsInternalnote` (config name: `internalNote`) | `TEXT` | yes | no — absent from Shop API schema entirely (independently confirmed via live GraphQL introspection) | [`customer-gil-tzipori-field/schema-execution.md`](work/customer-gil-tzipori-field/schema-execution.md) |
| `payment` | `customFieldsGil_payment` (config name: `gil_payment`) | `INTEGER` | yes, `DEFAULT (99999)` at the DB column level | not set — currently exposed to Shop API (no `public: false` was requested for this field; consistent with the business requirement, which didn't ask for it to be hidden) | [`payment-gil-payment-field/schema-execution.md`](work/payment-gil-payment-field/schema-execution.md) |
| `customer` | `customFieldsDror_cust` (config name: `dror_cust`) | `TEXT` | yes, no default | not set — currently exposed to Shop API (not requested to be hidden) | [`customer-dror-cust-field/schema-execution.md`](work/customer-dror-cust-field/schema-execution.md) |

### Custom table: `waitlist_entry` (first custom entity)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `integer`, primary key, autoincrement | no | |
| `createdAt`, `updatedAt` | `datetime`, `DEFAULT (datetime('now'))` | no | from `VendureEntity` |
| `productVariantId` | `integer` | no | plain id column, **no foreign key** (variants are soft-deleted, so a cascade would never fire; rows are cleared by `ProductVariantEvent('deleted')`) |
| `emailAddress` | `varchar` | no | stored trimmed and lower-cased |

Index: `IDX_8d540fc72938882dfce2138838`, **UNIQUE** on `(productVariantId, emailAddress)`. It enforces one row per address per variant, and its leading column serves the two real access patterns (who waits for variant X, how many wait for X). No other index: there is no query by email alone.

A row means "still waiting"; a notified or removed person has no row, so there is no status column. Introduced by [`back-in-stock-waitlist/schema-execution.md`](work/back-in-stock-waitlist/schema-execution.md).

Migrations: `src/migrations/1787489491389-AddProductVariantInternalNote.ts`, `src/migrations/1787549554034-AddCustomerGilTest.ts`, `src/migrations/1787641335045-AddCustomerInternalNote.ts`, `src/migrations/1787813335513-AddPaymentGilPayment.ts`, `src/migrations/1787823937827-AddCustomerDrorCust.ts`, `src/migrations/1792580616387-AddWaitlistEntry.ts`.

**Note on `customer.customFieldsGiltest`**: this column and its migration existed prior to this DBA update but were never recorded in this living document — a documentation gap, now closed. Its Shop API exposure is a known, separately-tracked bug (not introduced or fixed by the `customer-gil-tzipori-field` feature); see that feature's `technical-discovery.md` and `architecture.md` for details. This file does not carry a "fixed" status for it — check the actual `vendure-config.ts` for the current state of that field's `public` flag rather than relying on this note once that fix lands.
