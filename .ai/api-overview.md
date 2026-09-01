# API Overview — my-shop (Vendure 3.7.2)

Living reference of every top-level GraphQL operation exposed by this project, grouped by domain. Read directly via live introspection against the running dev server (`http://localhost:3000/admin-api` and `/shop-api`) — not from general Vendure documentation, since the exact operation set reflects this project's actual installed version and config (e.g. `internalNote` on `ProductVariant` already affects what's queryable, per `.ai/schema-overview.md`).

Maintained by the **Architect** stage of the DevSDLC pipeline — the natural owner, since architecture decisions ("does this already exist as an extension point / API surface, or does it need to be added") depend on knowing what's already exposed. Update this file whenever a feature adds, removes, or changes a top-level Admin/Shop API operation, with a pointer back to that feature's `architecture.md`.

This is a **top-level operation map** (Query/Mutation names, grouped by domain) — not a field-level schema. For field-level detail on a specific type, use the project's own GraphiQL (`http://localhost:3000/graphiql/admin` or `/graphiql/shop`) or the Admin API's `__type` introspection.

## Status as of 2026-08-23

- **Admin API** (`/admin-api`): 82 top-level queries, 179 top-level mutations.
- **Shop API** (`/shop-api`): 19 top-level queries, 32 top-level mutations — deliberately a small subset of Admin, since it's the customer-facing surface.
- Every custom field with `public: false` (e.g. `ProductVariant.internalNote`) is excluded from the Shop API at the schema level — this doesn't change the *operation* list above, but changes what fields are reachable through the operations that do exist (e.g. `products`/`product` on the Shop API).

---

## Admin API — by domain

### Catalog (products, variants, collections, facets, search)

| Queries | Mutations |
|---|---|
| `product`, `products`, `productOption`, `productOptions`, `productOptionGroup`, `productOptionGroups`, `productVariant`, `productVariants`, `collection`, `collections`, `collectionFilters`, `previewCollectionVariants`, `facet`, `facets`, `facetValue`, `facetValues`, `tag`, `tags`, `slugForEntity`, `search`, `pendingSearchIndexUpdates`, `entityDuplicators` | `createProduct`, `updateProduct`, `updateProducts`, `deleteProduct`, `deleteProducts`, `createProductOption`, `updateProductOption`, `deleteProductOption`, `deleteProductOptionGroups`, `createProductOptionGroup`, `updateProductOptionGroup`, `addOptionGroupToProduct`, `removeOptionGroupFromProduct`, `createProductVariants`, `updateProductVariant`, `updateProductVariants`, `deleteProductVariant`, `deleteProductVariants`, `createCollection`, `updateCollection`, `deleteCollection`, `deleteCollections`, `moveCollection`, `createFacet`, `updateFacet`, `deleteFacet`, `deleteFacets`, `createFacetValue`, `createFacetValues`, `updateFacetValue`, `updateFacetValues`, `deleteFacetValues`, `createTag`, `updateTag`, `deleteTag`, `importProducts`, `reindex`, `runPendingSearchIndexUpdates`, `duplicateEntity` |

### Orders & fulfillment

| Queries | Mutations |
|---|---|
| `order`, `orders`, `eligibleShippingMethodsForDraftOrder` | `createDraftOrder`, `deleteDraftOrder`, `addItemToDraftOrder`, `adjustDraftOrderLine`, `removeDraftOrderLine`, `setCustomerForDraftOrder`, `setDraftOrderShippingAddress`, `unsetDraftOrderShippingAddress`, `setDraftOrderBillingAddress`, `unsetDraftOrderBillingAddress`, `setDraftOrderShippingMethod`, `setDraftOrderCustomFields`, `applyCouponCodeToDraftOrder`, `removeCouponCodeFromDraftOrder`, `addNoteToOrder`, `updateOrderNote`, `deleteOrderNote`, `cancelOrder`, `modifyOrder`, `transitionOrderToState`, `setOrderCustomFields`, `setOrderCustomer`, `addManualPaymentToOrder`, `addFulfillmentToOrder`, `transitionFulfillmentToState`, `cancelPayment`, `settlePayment`, `transitionPaymentToState`, `refundOrder`, `settleRefund` |

### Customers

| Queries | Mutations |
|---|---|
| `customer`, `customers`, `customerGroup`, `customerGroups` | `createCustomer`, `updateCustomer`, `deleteCustomer`, `deleteCustomers`, `createCustomerAddress`, `updateCustomerAddress`, `deleteCustomerAddress`, `createCustomerGroup`, `updateCustomerGroup`, `deleteCustomerGroup`, `deleteCustomerGroups`, `addCustomersToGroup`, `removeCustomersFromGroup`, `addNoteToCustomer`, `updateCustomerNote`, `deleteCustomerNote` |

### Identity, auth & admin users

| Queries | Mutations |
|---|---|
| `me`, `activeAdministrator`, `administrator`, `administrators`, `role`, `roles`, `apiKey`, `apiKeys` | `login`, `logout`, `authenticate`, `createAdministrator`, `updateAdministrator`, `updateActiveAdministrator`, `deleteAdministrator`, `deleteAdministrators`, `createRole`, `updateRole`, `deleteRole`, `deleteRoles`, `assignRoleToAdministrator`, `createApiKey`, `updateApiKey`, `rotateApiKey`, `deleteApiKeys` |

### Channel & region

| Queries | Mutations |
|---|---|
| `activeChannel`, `channel`, `channels`, `country`, `countries`, `province`, `provinces`, `zone`, `zones`, `seller`, `sellers` | `createChannel`, `updateChannel`, `deleteChannel`, `deleteChannels`, `createCountry`, `updateCountry`, `deleteCountry`, `deleteCountries`, `createProvince`, `updateProvince`, `deleteProvince`, `createZone`, `updateZone`, `deleteZone`, `deleteZones`, `addMembersToZone`, `removeMembersFromZone`, `createSeller`, `updateSeller`, `deleteSeller`, `deleteSellers`, plus 18 `assign*ToChannel` / `remove*FromChannel` mutations (assets, collections, facets, payment methods, product option groups, product variants, products, promotions, shipping methods, stock locations) |

### Payments, shipping, tax & promotions

| Queries | Mutations |
|---|---|
| `paymentMethod`, `paymentMethods`, `paymentMethodEligibilityCheckers`, `paymentMethodHandlers`, `shippingMethod`, `shippingMethods`, `shippingCalculators`, `shippingEligibilityCheckers`, `fulfillmentHandlers`, `taxCategory`, `taxCategories`, `taxRate`, `taxRates`, `promotion`, `promotions`, `promotionActions`, `promotionConditions` | `createPaymentMethod`, `updatePaymentMethod`, `deletePaymentMethod`, `deletePaymentMethods`, `createShippingMethod`, `updateShippingMethod`, `deleteShippingMethod`, `deleteShippingMethods`, `testShippingMethod`, `testEligibleShippingMethods`, `createTaxCategory`, `updateTaxCategory`, `deleteTaxCategory`, `deleteTaxCategories`, `createTaxRate`, `updateTaxRate`, `deleteTaxRate`, `deleteTaxRates`, `createPromotion`, `updatePromotion`, `deletePromotion`, `deletePromotions` |

### Assets & stock

| Queries | Mutations |
|---|---|
| `asset`, `assets`, `stockLocation`, `stockLocations` | `createAssets`, `updateAsset`, `deleteAsset`, `deleteAssets`, `createStockLocation`, `updateStockLocation`, `deleteStockLocation`, `deleteStockLocations` |

### System, jobs & settings

| Queries | Mutations |
|---|---|
| `dashboardMetricSummary`, `globalSettings`, `job`, `jobs`, `jobsById`, `jobQueues`, `jobBufferSize`, `scheduledTasks`, `settingsStoreFieldDefinitions`, `getSettingsStoreValue`, `getSettingsStoreValues` | `updateGlobalSettings`, `cancelJob`, `flushBufferedJobs`, `removeSettledJobs`, `runScheduledTask`, `updateScheduledTask`, `setSettingsStoreValue`, `setSettingsStoreValues` |

---

## Shop API — by domain

### Browsing (customer-facing catalog)

| Queries | Mutations |
|---|---|
| `product`, `products`, `collection`, `collections`, `facet`, `facets`, `search`, `activeChannel`, `availableCountries` | *(none — browsing is read-only)* |

### Cart & checkout

| Queries | Mutations |
|---|---|
| `activeOrder`, `order`, `orderByCode`, `nextOrderStates`, `eligibleShippingMethods`, `eligiblePaymentMethods`, `activePaymentMethods`, `activeShippingMethods` | `addItemToOrder`, `addItemsToOrder`, `adjustOrderLine`, `removeOrderLine`, `removeAllOrderLines`, `applyCouponCode`, `removeCouponCode`, `setOrderShippingAddress`, `unsetOrderShippingAddress`, `setOrderBillingAddress`, `unsetOrderBillingAddress`, `setOrderShippingMethod`, `setCustomerForOrder`, `setCurrencyCodeForOrder`, `setOrderCustomFields`, `transitionOrderToState`, `addPaymentToOrder` |

### Account & auth

| Queries | Mutations |
|---|---|
| `activeCustomer`, `me` | `login`, `logout`, `authenticate`, `registerCustomerAccount`, `verifyCustomerAccount`, `refreshCustomerVerification`, `requestPasswordReset`, `resetPassword`, `updateCustomer`, `updateCustomerEmailAddress`, `requestUpdateCustomerEmailAddress`, `updateCustomerPassword`, `createCustomerAddress`, `updateCustomerAddress`, `deleteCustomerAddress` |

---

## Notable observations

- **Shop API is a strict, intentionally small subset** — 51 total operations vs. Admin's 261. Nearly every Shop mutation exists for the customer's own cart/account; there is no bulk/admin-style operation anywhere in it.
- **Draft orders are an Admin-only concept** (`createDraftOrder` and its whole `*DraftOrder*` family) — used for admin-created/phone orders, not exposed to customers, who instead build up `activeOrder` through the Shop API's own add/adjust/remove operations.
- **`authenticate`, `login`, `logout` exist on both APIs** but scope to different principals — Administrator sessions on Admin, Customer sessions on Shop.
- **Assign/remove-from-channel mutations** (18 of them) are the multi-channel/multi-storefront mechanism — worth knowing about before assuming a new "channel scoping" feature needs custom code; it likely doesn't.

## Custom additions

_(none yet at the operation level — `ProductVariant.internalNote` from the `variant-internal-note` feature changes what's reachable through the *existing* `productVariant`/`productVariants`/`updateProductVariant` operations on the Admin API, and is absent from the Shop API's `product`/`products`, but it did not add or remove any top-level operation. This section will list new operations if a future feature adds one, with a pointer to that feature's `architecture.md`.)_

`Customer.internalNote` (from the `customer-gil-tzipori-field` feature, see [`architecture.md`](work/customer-gil-tzipori-field/architecture.md)) is the same shape of change: reachable through the *existing* `customer`/`customers`/`updateCustomer` operations on the Admin API only, `public: false` so it's absent from the Shop API's `customer`-facing `updateCustomer`/`activeCustomer`/`me`. No top-level operation added or removed.
