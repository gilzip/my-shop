# Modules & Main Features Overview — my-shop (Vendure 3.7.2)

Living reference of every module in the running system — Vendure's own core service modules plus the plugins actually registered in this project — and the main features each one provides. Read directly from the installed `@vendure/core` service classes (`.d.ts` signatures and JSDoc) and each plugin's own JSDoc/config, not from general Vendure knowledge, since exact methods and options vary by version.

Maintained by the **Technical PM** stage of the DevSDLC pipeline — the natural owner, since its discovery process ("what already exists, what can be reused, what must be extended") depends on knowing what capability already lives in the system before writing an Epic/Stories. Update this file whenever a feature adds a new module, plugin, or materially extends an existing one's responsibilities, with a pointer back to that feature's `technical-discovery.md`.

Companion documents: [`.ai/schema-overview.md`](schema-overview.md) (tables/relations) and [`.ai/api-overview.md`](api-overview.md) (GraphQL operations). This document sits one level above both — it's "what capability exists and where," while the other two are "what data" and "what API surface" that capability produces.

## Status as of 2026-08-23 (updated after `free-shipping-israel` and `first-order-discount`)

Core module set is 100% stock `@vendure/core` 3.7.2. Seven plugins are registered in `src/vendure-config.ts`, all official Vendure packages — no custom plugins exist yet (`src/plugins/` is empty). Three custom extensions are now registered directly as handler/checker/condition objects, not plugins: `applePaySimulatedHandler` (payment), `freeShippingIsraelChecker` (shipping), `isFirstOrderCondition` (promotions).

---

## Core modules

### 1. Catalog
**Services**: `ProductService`, `ProductVariantService`, `ProductOptionService`, `ProductOptionGroupService`, `FacetService`, `FacetValueService`, `CollectionService`, `TagService`, `AssetService`.

- Product/variant CRUD, channel assignment, and per-channel price/tax resolution.
- Variant options (size/color-style attributes) with in-use checks before delete.
- Facets/facet values for filtering and search faceting.
- Tree-structured Collections with breadcrumbs, ancestors/descendants, and a background job that re-evaluates Collection filters via the JobQueue.
- Generic free-text tagging usable on any taggable entity.
- Asset upload with three-signal MIME validation (content-type header, extension, magic bytes — hardened against a documented CVE-class issue), featured-asset management, channel assignment.

### 2. Search
**Service**: `SearchService` (thin adapter — `reindex()` only; real indexing logic lives in whichever plugin calls its `adopt()` method — see DefaultSearchPlugin below).

### 3. Identity & Access
**Services**: `CustomerService`, `UserService`, `AuthService`, `AdministratorService`, `RoleService`, `ApiKeyService`, `SessionService`.

- Customer registration/verification, password reset, email-change flow, address book.
- Shared credentialed identity (`UserService`) underlying both customers and admins.
- Pluggable authentication strategies, session lifecycle (authenticated + anonymous), session caching.
- Admin CRUD with a guarantee that at least one SuperAdmin always exists; Role/permission checks per-channel; API keys with documented privilege-escalation guards.

### 4. Order & Commerce
**Services**: `OrderService` (523 lines — the largest core service), `OrderTestingService`, `PaymentService`, `PaymentMethodService`, `FulfillmentService`, `HistoryService`.

- Full order lifecycle: items, coupon codes, addresses, shipping quotes, state-machine transitions, post-completion `modifyOrder`, payments, refunds, cancellation, order merging on login.
- Documented concurrency-safety handling for coupon usage limits under simultaneous checkouts (differs by DB isolation level — referenced against a real upstream PR).
- `OrderTestingService` creates temporary mock orders to test ShippingMethod/Promotion configs without placing a real order.
- Payment/Fulfillment state machines resolve against configured `PaymentMethodHandler`/`FulfillmentHandler` — this is exactly where this project's custom `applePaySimulatedHandler` plugs in.
- Audit-trail history entries for Orders/Customers, extensible with custom entry types via TypeScript declaration merging.

### 5. Inventory & Stock
**Services**: `StockLevelService` (`@since 2.0.0`), `StockLocationService`, `StockMovementService`.

- Single entry point for adjusting `stockOnHand`/`stockAllocated` — availability logic delegates to a configurable `StockLocationStrategy`.
- Multi-warehouse stock locations with channel assignment.
- Ledger-style stock movement entities (`Allocation`, `Sale`, `Cancellation`, `Release`, `StockAdjustment`) backing every stock change.

### 6. Pricing, Tax & Promotions
**Services**: `PromotionService`, `TaxRateService`, `TaxCategoryService`.

- Coupon-code validation via configurable `PromotionCondition`/`PromotionAction` registries, with the same documented concurrency-safe usage-limit locking as `OrderService`.
- Tax rate resolution by Zone × TaxCategory, with an in-memory active-rate cache.

### 7. Shipping
**Service**: `ShippingMethodService`.

- ShippingMethod CRUD, exposing configurable `ShippingEligibilityChecker`/`ShippingCalculator`/`FulfillmentHandler` operations, with channel assignment.

### 8. Geography/Locale
**Services**: `ZoneService`, `CountryService`, `ProvinceService`.

- Supporting entities for tax/shipping rule resolution — zones group countries/provinces, with cached member lookups.

### 9. Platform/Multi-tenancy
**Services**: `ChannelService`, `SellerService`, `GlobalSettingsService`.

- Multi-channel core: generic channel assignment/removal for any channel-aware entity, default-channel bootstrap.
- Multi-vendor/marketplace Seller entities (guaranteed default Seller).
- Single global settings row (e.g. default out-of-stock threshold).

### Job Queue & Scheduler (core infrastructure)

Core defines the abstract `JobQueueStrategy`/`SchedulerStrategy` interfaces plus in-memory/polling base implementations — the actual production-grade, SQL-backed implementations are supplied by plugins (see DefaultJobQueuePlugin/DefaultSchedulerPlugin below), not by core directly.

---

## Registered plugins

### GraphiqlPlugin
"Provides a GraphiQL UI for exploring and testing the Vendure GraphQL APIs" — adds `/graphiql/admin` and `/graphiql/shop` routes. This project uses it with defaults (route `graphiql`).

### AssetServerPlugin
"Serves assets... from the local file system, and can also be configured to use other storage strategies (e.g. S3)." Also performs on-the-fly image transformation (resize/crop/format conversion, focal-point cropping, named presets) with caching.
This project: `route: 'assets'`, local `assetUploadDir`, dev/prod-conditional `assetUrlPrefix`.

### EmailPlugin
"Creates and sends transactional emails based on Vendure events" — MJML templates + Nodemailer, subscribing to core events via `EmailEventHandler`s. Bundled default handlers cover order confirmation, email verification, password reset, and email-change requests.
This project: `devMode: true` with a local dev-mailbox UI at route `mailbox` — **the `globalTemplateVars` verify/reset/change-email URLs still point at `localhost:8080`, a placeholder storefront that doesn't exist in this backend-only repo** (a pre-existing scaffold artifact, not something this doc introduces).

### DashboardPlugin
"Serves the static files of the Vendure Dashboard and provides the GraphQL extensions needed for the order metrics on the dashboard index page." Proxies to a Vite dev server in development, serves built static files in production.
This project: `route: 'dashboard'`, dev/prod-conditional `appDir`.

### DefaultJobQueuePlugin — *default/swappable implementation*
Configures Vendure to persist JobQueue jobs via `SqlJobQueueStrategy` — explicitly documented as "used by the DefaultJobQueuePlugin," implying other `JobQueueStrategy` implementations (e.g. Redis-backed) exist in the ecosystem and could replace it.
This project: `useDatabaseForBuffer: true`.

### DefaultSchedulerPlugin — *default/swappable implementation* (`@since 3.3.0`)
"Configures a default scheduling strategy that executes scheduled tasks using the database to ensure each task runs exactly once... even with multiple worker instances." Uses `SELECT ... FOR UPDATE` locking on Postgres/MySQL/MariaDB; falls back to an atomic UPDATE for SQLite — **relevant here since this project runs on `better-sqlite3`.**
This project: called with no args (framework defaults).

### DefaultSearchPlugin — *default/swappable implementation*
"Provides a full-text Product search based on the full-text searching capabilities of the underlying database... if you are not using an alternative search plugin, make sure this one is used, otherwise you will not be able to search products." Explicitly documents that search quality varies by database — **SQLite's full-text search is weaker than MySQL/Postgres's, worth remembering before assuming search behavior will carry over unchanged to a production database engine.**
This project: `bufferUpdates: false`, `indexStockStatus: true`.

---

## Notable observations

- **Three plugins are explicitly self-documented as the "default" of a swappable strategy** (Job Queue, Scheduler, Search) — each names its underlying strategy interface in its own JSDoc. Before building custom infrastructure for background jobs, scheduled tasks, or search, check whether swapping the strategy (not writing new infrastructure) is the smaller change.
- **SQLite is a real behavioral variable, not just a dev convenience**: both the Scheduler and Search plugins' own documentation calls out SQLite-specific fallback behavior or weaker feature support compared to Postgres/MySQL — worth revisiting when this project moves to a production database.
- **The EmailPlugin's storefront URLs are dangling** (`localhost:8080`) — flagged here because it's a "module configuration" issue a Technical PM doing discovery should know about, distinct from the already-documented lack-of-storefront gap in the general repo audit.
- **`SearchService` in core is deliberately a thin shell** — real search behavior always comes from whichever plugin calls `adopt()` on it (currently DefaultSearchPlugin). A feature that needs different search behavior should look at swapping/configuring that plugin, not extending `SearchService` directly.

## Custom additions

No custom plugins exist in `src/plugins/` — every addition so far is a small object registered directly into an existing module's extension-point array, not a new module:

| Module | Extension | Introduced by |
|---|---|---|
| Catalog | `ProductVariant.internalNote` customField (documented in `.ai/schema-overview.md`/`.ai/api-overview.md`, not a new module) | [`variant-internal-note/technical-discovery.md`](work/variant-internal-note/technical-discovery.md) |
| Shipping | `freeShippingIsraelChecker` (`ShippingEligibilityChecker`, code `free-shipping-israel-checker`) | [`free-shipping-israel/technical-discovery.md`](work/free-shipping-israel/technical-discovery.md) |
| Pricing, Tax & Promotions | `isFirstOrderCondition` (`PromotionCondition`, code `is_first_order`) | [`first-order-discount/technical-discovery.md`](work/first-order-discount/technical-discovery.md) |
| Pricing, Tax & Promotions | `buyXGetYDiscountAction` (`PromotionItemAction`, code `buy_x_get_y_discount`) - reuses the built-in `buyXGetYFreeCondition` unchanged | [`buy-x-get-y-discount/technical-discovery.md`](work/buy-x-get-y-discount/technical-discovery.md) |
