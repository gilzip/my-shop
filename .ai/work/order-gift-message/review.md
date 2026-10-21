# Review: order-gift-message

**Reviewed:** 2026-10-21
**Code under review:** the uncommitted changes on `demo/order-gift-message` in `C:\vendure\my-shop-demo` (backend) and `C:\vendure\storefront-demo` (storefront).
**Method:** `implementation.md` was treated as a claim. I read the diff in both worktrees, re-traced the framework paths the design relies on, and verified the behavior live:
- the demo server on `:3100`, from the build that includes the migration, with the demo-only superadmin;
- the demo database;
- the demo storefront on `:3101`, through a full browser checkout.

The live suite is in `e2e-gift.mjs`, in this folder.

## 1. Business request satisfaction: met, except one rule (Finding A)

| Rule / story | Evidence (live) |
|---|---|
| S1: add, change, remove at checkout | set / replace / whitespace-clear on the active order; persists and stays editable in `ArrangingPayment`. **Storefront:** a Hebrew + emoji message typed in the review step, saved ("Saved" / "Remove" shown), counter `33 / 200`, shown in the order summary |
| S2: 200 characters, plain text, languages | 200 graphemes (150 Hebrew letters and 50 🎂) accepted; 201 refused with "limited to 200 characters (got 201)" and the previous value kept; control character refused; `<3 <b>love</b>` stored as typed; `מזל טוב! Happy birthday 🎂\nמ-דנה` round-trips byte for byte; the limit applies to staff too |
| S3: the customer sees it after placement and cannot change it | owner session reads it via `orderByCode`; after placement `setOrderCustomFields` returns `NoActiveOrderError`. **Storefront order `D47QHZFYXHHNBLFX`:** the Admin API returns exactly `מזל טוב ליום ההולדת! 🎂 Love, Dana` |
| S3: nobody else can see it | Cycle 1: **failed**; a fresh anonymous session holding the order code read the message (Finding A). Cycle 2, against amended rule 7: another **signed-in** customer is refused ("not currently authorized"); an anonymous code-holder can read within 2 hours, as accepted |
| S4: staff see and correct it until shipment | staff read it exactly; staff correction saved before shipment; after a manual fulfillment reaches `Shipped`, refused with "cannot be changed after the order has shipped" and the value unchanged; **still refused after the order moved to `Modifying`** |
| Rule 5: free | total 599 with and without a message |

## 2. Reuse of Vendure extension points: good

- custom field config plus the field's own `validate` hook;
- the existing Shop and Admin `setOrderCustomFields` (no new operation);
- `OrderService.findOne` / `getOrderFulfillments`;
- one `APP_INTERCEPTOR` built with the same exported helpers (`parseContext`, `internal_getRequestContext`) that core's `CustomFieldProcessingInterceptor` uses.

`public: true` is declared explicitly with its reason, as `AGENTS.md` requires.

## 3. Preservation of existing behavior: preserved

- **Regression (2026-10-21 suite, against `:3100`):** **21/21**: checkout, first-order discount, Apple Pay simulated, standard payment, free shipping Israel, buy X get Y, edge cases.
- **protect-internal-custom-fields suite (against `:3100` and the demo database):** **22/22**. Internal fields are still hidden and write-guarded, and the data is unchanged.
- **Interceptor scope:** it returns early unless the mutation is `setOrderCustomFields` / `setDraftOrderCustomFields` **and** the input carries `giftMessage` (read in the diff). Other mutations, and other custom fields set through the same mutation, are untouched.
- **Existing data:** existing orders have `NULL`, and totals were identical before and after the migration (`schema-execution.md`, re-read).

## 4. Coherent multi-step behavior: coherent

The lifecycle fits together:
1. The customer can edit while the order is active.
2. Nobody can edit as the customer once it is placed (the framework).
3. Staff can edit until the first shipped or delivered fulfillment (the plugin).
4. Edits stay closed after that, even through `Modifying`.

Normalization is the same in both APIs.

## 5. Registration and configuration: correct

- The field is inside `internalByDefault({...})` and is left untouched because of its explicit `public: true`.
- The plugin is registered.
- Migration `1792591766697-AddOrderGiftMessage` has run, and the drift check is clean.
- **DBA correction verified:** in the file, `down` rebuilds into `temporary_order` and never renames `order` away. On a copy, the corrected `down` left the baseline 2 foreign key violations only.

## 6. Test coverage: good, with one wrong expectation upstream

- **Unit tests:** 7 new tests for graphemes (incl. ZWJ), the limit, control characters, HTML, normalization and `hasShipped`; `npm test` passes 22/22.
- **Live suite:** 21 checks, including the hard cases (post-shipment cutoff, `Modifying`, exact-200 with emoji, the totals invariant, owner vs. other session).
- **Storefront:** `check-types` passes, lint is clean, and the browser checkout was verified end to end.
- **The live suite found Finding A,** which the upstream documents had marked as "already enforced".

## 7. Focused scope: focused

- **Backend:** config, a new plugin folder, the migration, the unit test and the living docs.
- **Storefront:** only the checkout and account gift-message files, the regenerated `graphql-env.d.ts`, and the gql.tada schema URL.
- Nothing unrelated.

## 8. No unnecessary infrastructure: none

One rules file, one interceptor, and one plugin wrapper. No new dependency.

## Findings

### A. Blocking: business rule 7 ("only the ordering customer and staff can see it") is not met for a 2-hour window

**What happens:** Vendure's default `DefaultOrderByCodeAccessStrategy` (`config/order/order-by-code-access-strategy.js:23-35`) lets **any request that is not logged in and holds the order code** read the order for `anonymousAccessDuration` (default `2h`) after `orderPlacedAt`, whoever the customer is. The live check confirmed it: a brand-new session read the Hebrew message by order code. **Root cause upstream:** `technical-discovery.md` and `architecture.md` (Verified architecture §5) state that `orderByCode` "already enforces ownership". That is incorrect.

**Context:** this is existing framework behavior. It already exposes the order's address, name and items in the same way, and it is how the guest order-confirmation page works. The order code is a random 16-character value. The feature did not create the exposure; it adds one more field to it.

**Required to pass. The stakeholder chooses one:**
1. **Accept (recommended).** Amend business rule 7 to: "the ordering customer, anyone holding that order's confirmation code within 2 hours of ordering (as with the rest of the order details), and staff". Correct `architecture.md` §5 and `technical-discovery.md` to describe the real strategy, and change the live check "another session cannot read" to "another logged-in customer cannot read; an anonymous code-holder can for 2 hours".
2. **Tighten.** Set `orderOptions.orderByCodeAccessStrategy` to a shorter window, or a custom strategy. Developer stage. Note that this changes access to **all** order data, the guest confirmation page and guest `cancelMyOrder` (which relies on the same strategy), so it needs its own regression run.

### B–F. Non-blocking

- **B.** The order **confirmation** page does not show the message. The stories require only the checkout summary and the account order details, so this is optional polish.
- **C.** The running demo `dist/` was built before the DBA's `down` correction. Rebuild (`npm run build:server`) before anyone runs `migrate --revert` from `dist`.
- **D.** The storefront gql.tada `schema` now points at `localhost:3100`. Point it at the shop's own API before merging anywhere permanent.
- **E.** Older migrations' `down` methods have the same rename-first flaw (`schema-execution.md`); `AddCustomerGilTest` was seen in code. Separate follow-up.
- **F.** `order-self-cancellation` judges "shipped" from `order.state` only, so it has the same `Modifying` blind spot that this feature avoided. Separate follow-up.

## Cycle 2 (2026-10-21): Finding A resolved

**Stakeholder decision:** option 1, accept. No code was changed.

**Documents corrected:**
- `business-requirement.md` rule 7 (amended, with attribution);
- `architecture.md` Verified architecture §5 (wrong claim replaced, with source reference);
- `technical-discovery.md` (struck through and corrected);
- `stories.md` Story 3 (split into the signed-in and code-holder cases).

**Test changed:** the "another session cannot read" check was replaced by the two amended criteria. Another signed-in customer, created by the demo admin with a generated password, is refused. An anonymous code-holder can read within 2 hours.

**Re-run, all against `:3100`:**

| Suite | Result |
|---|---|
| `e2e-gift.mjs` | **22/22** |
| 2026-10-21 regression | **21/21** |
| protect-internal-custom-fields | **22/22** |
| Unit tests | **22/22** |

Findings B–F remain non-blocking follow-ups.

## Verdict

PASS
