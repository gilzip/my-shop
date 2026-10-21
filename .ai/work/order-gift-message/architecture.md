# Architecture: order-gift-message

## Verified architecture

Every item below was checked independently against the installed `@vendure/core` 3.7.2 and the live schema.

1. **Customer edits: no new code needed.**
   - Shop `setOrderCustomFields` edits only the session's active order (`shop-order.resolver.js:146-153`); otherwise it returns `NoActiveOrderError`.
   - A placed order is no longer active, so "no customer edits after placement" holds already. It still gets an E2E check.
2. **Staff edits: the only path is Admin `setOrderCustomFields`.**
   - It goes to `OrderService.updateCustomFields` (`order.service.js:386-393`), which has **no state check**.
   - `modifyOrder`'s `ModifyOrderInput` has **no `customFields`** (live introspection): `dryRun, orderId, addItems, adjustOrderLines, surcharges, updateShippingAddress, updateBillingAddress, note, refund, refunds, options, couponCodes, shippingMethodIds`.
   - The Vendure dashboard edits order custom fields through `setOrderCustomFields` (`@vendure/dashboard/.../order-detail-shared.tsx`).
   - `setDraftOrderCustomFields` applies only to draft orders, which have never shipped.
3. **"Has shipped" cannot be judged from `order.state` alone.**
   - `Shipped`, `PartiallyShipped` and `PartiallyDelivered` can all transition to `Modifying` (`default-order-process.js:81-88`).
   - So a shipped order can sit in `Modifying` (or later states) while its goods are already out.
   - The reliable signal is the order's fulfillments: `OrderService.getOrderFulfillments(ctx, order)` is a public API (`order.service.d.ts:441`).
4. **String limits are not enforced by Vendure or SQLite.**
   - `validateStringField` checks only `pattern`; `length` sets the column size; SQLite ignores `varchar(n)`.
   - The field's `validate(value, injector, ctx)` hook runs for every submitted value from both APIs (`validate-custom-field-value.js:87-97`), and errors become `UserInputError`.
5. **Visibility.**
   - `internalByDefault` leaves fields with explicit `public: true` untouched and adds no guard (`internal-by-default.ts`, with a unit test).
   - With `public: true`, Shop `activeOrder` and `orderByCode` expose the field.
   - **Corrected after review Finding A:** `orderByCode` uses the default `DefaultOrderByCodeAccessStrategy` (`config/order/order-by-code-access-strategy.js:23-35`). A logged-in user can read only their own orders. **Any request that is not logged in** and holds the order code can read **any** order for `anonymousAccessDuration` (default `2h`) after `orderPlacedAt`. The original claim ("owner, or the guest session that placed it") was wrong. The stakeholder accepted this existing behavior (business rule 7, amended), so the design is unchanged.
6. **Interceptor helpers are public API.** `parseContext` and `internal_getRequestContext` are exported from `@vendure/core` (`api/index.d.ts`). They are what core's own `CustomFieldProcessingInterceptor` uses.

## Proposed design

### A. Field definition (`src/vendure-config.ts`)

```ts
Order: [{
    name: 'giftMessage',
    type: 'text',              // multi-line; line breaks allowed
    nullable: true,
    public: true,              // deliberate: the ordering customer writes and reads it (AGENTS.md rule)
    label: [{ languageCode: LanguageCode.en, value: 'Gift message' }],
    description: [{ languageCode: LanguageCode.en, value: 'Customer-facing: a personal note to the gift recipient, max 200 characters. Public because the customer writes it at checkout and sees it on their order.' }],
    validate: validateGiftMessage,
}]
```

### B. Rules (`src/plugins/order-gift-message/gift-message-rules.ts`, pure and unit-tested)

- `GIFT_MESSAGE_MAX = 200`.
- `countCharacters(s)` counts **grapheme clusters** using `Intl.Segmenter`, so 🎂, 👨‍👩‍👧 and Hebrew letters each count as 1. That matches what a person sees.
- `validateGiftMessage(value)`:
  - `null` or whitespace-only is valid (it means "no message");
  - more than 200 characters is an error: `Gift message is limited to 200 characters (got N).`;
  - control characters other than `\n`, `\r` and `\t` are an error.
  - HTML-like text is **stored as typed** and is always shown as plain text. The dashboard and the storefront (React) escape by default; nothing renders it as markup. Rejecting `<` would refuse legitimate messages such as "<3".
- `normalizeGiftMessage(value)`: whitespace-only becomes `null`; otherwise the value is unchanged (no trimming of real content).
- `hasShipped(fulfillmentStates)`: true if any fulfillment is `Shipped` or `Delivered`.

### C. Plugin `OrderGiftMessagePlugin` (`src/plugins/order-gift-message/`)

- One NestJS interceptor, registered as `APP_INTERCEPTOR`, following the core pattern.
- It acts only on mutations whose input carries `customFields.giftMessage`: Shop `setOrderCustomFields`, and Admin `setOrderCustomFields` / `setDraftOrderCustomFields`.
  1. **Normalize:** whitespace-only is replaced by `null` in the args, in both APIs.
  2. **Staff cutoff:** for Admin `setOrderCustomFields`, load the order and its fulfillments. If `hasShipped`, throw `UserInputError('Gift message cannot be changed after the order has shipped.')`.
- No new API operations and no other mutation is touched.

### D. Storefront: recommended in scope, in a separate worktree

- Story 6 is what makes the feature usable by customers. Without it, the run proves only the API.
- **Recommendation:** run it in an isolated worktree of the storefront repository, `C:\vendure\storefront-demo`, on branch `demo/order-gift-message`. It runs on port **3101** and points at the demo server on **3100**.
- **Changes:**
  - the checkout step: an optional textarea with a live grapheme counter, saved through `setOrderCustomFields`;
  - the checkout and cart order summaries;
  - the account order detail;
  - en/de messages;
  - `dir="auto"` on the displayed message, so Hebrew renders right-to-left.
- **Caveat:** the 3 storefront fixes made on 2026-10-21 (FREE shipping label) are uncommitted in `C:\vendure\storefront`. A worktree from `HEAD` would not include them. See the decision needed below.

## Files to create or modify

| File | Change |
|---|---|
| `src/vendure-config.ts` | `Order.giftMessage` field; register `OrderGiftMessagePlugin` |
| `src/plugins/order-gift-message/gift-message-rules.ts` | **New**: pure rules |
| `src/plugins/order-gift-message/gift-message.interceptor.ts` | **New**: normalize and staff cutoff |
| `src/plugins/order-gift-message/order-gift-message.plugin.ts` | **New**: `@VendurePlugin` providing the interceptor |
| `test/gift-message-rules.test.ts` | **New**: unit tests |
| `src/migrations/<ts>-AddOrderGiftMessage.ts` | **New**: generated by the DBA stage (`customFieldsGiftmessage TEXT NULL` on `order`) |
| `AGENTS.md`, `.ai/schema-overview.md`, `.ai/modules-overview.md` | Living docs: first public custom field and the new plugin |
| Storefront (if in scope) | `features/checkout/...` (step, summary, graphql, messages), `features/cart/routes/order-summary.tsx`, `features/account/routes/orders/[code]/order-detail.tsx` |

## Registration and configuration

- Plugin added to `plugins: [...]`.
- Field added to `customFields` inside `internalByDefault({...})`; it is untouched by the wrapper because it declares `public: true`.
- The migration is run by the DBA stage on the **demo** database only.

## API map

No operation is added or removed; `setOrderCustomFields` already exists. `.ai/api-overview.md` needs no operation change, only a note that Order now has a public custom field.

## Tests to add

1. **Unit tests** (`npm test`):
   - grapheme counting (Hebrew, emoji, ZWJ family);
   - 200 accepted, 201 refused;
   - newline kept;
   - control characters refused;
   - whitespace normalized to `null`;
   - `hasShipped` for each fulfillment state.
2. **Live E2E** against the demo server (`:3100`) and the demo database:
   - **Shop:** set, change and clear the message; 200 and 201; a Hebrew + emoji round trip; the message persists into `ArrangingPayment`; refused after placement (`NoActiveOrderError`); visible through `orderByCode` for the owner and not for another session; totals unchanged.
   - **Admin:** edit before shipment succeeds; after a fulfillment reaches `Shipped`, refused; still refused after the order moves to `Modifying`.
   - **Regression:** the 2026-10-21 suite (21 checks) and the protect-internal-custom-fields suite (22 checks) against `:3100`.
   - **Admin authentication for tests:** the demo server starts with a **demo-only** `SUPERADMIN_USERNAME` and `SUPERADMIN_PASSWORD`, generated for this run and recorded in a gitignored demo file. Vendure creates that superadmin in the **demo copy** of the database (`ensureSuperAdminExists`), so no real credential is read or used. The other settings come from the main `.env` through `DOTENV_CONFIG_PATH`; the pipeline never reads that file itself.
3. **Storefront** (if in scope): a full checkout with a Hebrew message in the browser, then the message is checked in the order summary, the order detail and the dashboard.

## Risks

- **Interceptor ordering:** relative to core's `CustomFieldProcessingInterceptor` it does not matter. Normalization makes the value `null` or leaves it unchanged, and `validate` accepts both. The shipped check is independent of validation.
- **`Intl.Segmenter`** is available in Node 24 and in current browsers. The counts may differ by edge cases from other "character" definitions, but they are consistent between server and storefront, which use the same algorithm.
- **SQLite migration** rebuilds the `order` table, the largest table, with foreign keys. The DBA must verify row counts and foreign keys before and after.
- **Storefront in a second repository** adds coordination; mitigated by its own worktree.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Cutoff in the field's `validate` | `validate` gets the value and the context, not the order, so it cannot see fulfillments |
| TypeORM `beforeUpdate` subscriber on `Order` | Runs on every order save (state transitions, totals); the error surfaces as an internal error; harder to scope to staff edits |
| Cutoff based on `order.state` only | Misses shipped orders that later moved to `Modifying` |
| `type: 'string'` with `length: 200` | Single-line; the length is not enforced on SQLite; counts UTF-16 units |
| Rejecting HTML-like text | Refuses harmless text such as "<3"; escaping at display is the correct protection |
| A new `setGiftMessage` mutation | Duplicates the existing `setOrderCustomFields` |

## Stakeholder decision (2026-10-21)

The architecture was approved on the SDLC dashboard, and the storefront scope was answered in chat: **(b)**. Commit the 3 storefront fixes to a local, unpushed storefront branch, then build the storefront part in a worktree created from it.

## Decision needed from the stakeholder (pause point, now resolved)

Storefront scope:
- **(a)** include it, in `C:\vendure\storefront-demo` from current `HEAD`, without the 3 uncommitted fixes;
- **(b)** include it, after first committing the 3 fixes to a local storefront branch, not pushed;
- **(c)** leave the storefront as a follow-up, and demo the feature through the API and the Vendure dashboard only.
