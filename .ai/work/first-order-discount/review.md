# Review: Automatic 10% Discount on a Customer's First Order

No `git diff` available (same pre-existing gap as before). Every claim below was independently re-verified against real source and a fresh live checkout session I created myself - not the Developer stage's sessions.

## Checklist

**1. Business request satisfaction.** Read `src/promotions/is-first-order-condition.ts` and `src/vendure-config.ts` directly, then ran my own fresh checkout: a brand-new email (`reviewer-check-1@example.com`), two units of a variant, subtotal 233,820 before discount → after a recalculating mutation, `activeOrder.discounts` showed `"First Order 10% Off": -12,990` on the reduced quantity (one unit, 129,900 → 12,990 = exactly 10%). Delivers exactly what was asked, automatically, with no coupon code entered anywhere in the flow.

**2. Reuse of Vendure's extension points.** Confirmed the entire change is one `PromotionCondition` plus a `promotionOptions` config entry, reusing the built-in `order_percentage_discount` action untouched. No parallel discount mechanism.

**3. Preservation of existing behavior.** This was the most important thing to verify, since this feature touches a config array the same way the shipping feature did. I created my own fresh temporary promotion using the untouched built-in `minimum_order_amount` condition (threshold 50,000, 3% off) and confirmed it fired correctly on a real order (378,009 = 389,700 × 0.97, exact) - independent proof that spreading `defaultPromotionConditions` did not break the other four built-in conditions. Cleaned up my test promotion afterward.

**4. Coherent behavior.** Not a payment lifecycle feature - the relevant check is whether eligibility (the condition) and the discount (the action) act as one consistent unit. Confirmed: the condition gates whether the action runs at all; there's no partial-application state.

**5. Correct registration/configuration.** `promotionOptions.promotionConditions: [...defaultPromotionConditions, isFirstOrderCondition]` in `vendure-config.ts` - confirmed by direct read. The new `Promotion` row's `conditions`/`actions` JSON matches the expected `ConfigurableOperation` shape exactly.

**6. Test coverage.** No automated framework exists (pre-existing gap). I did not accept the Developer's logged results - I independently re-ran the full flow myself on fresh sessions: a new customer's first order (discount applied), the same email's second order (no discount, and confirmed via `customer.id` that it really is the same Customer record, not a lookup miss that happened to also show no discount for the wrong reason), and the Story 4 regression check. All three matched the Developer's claims.

**7. Focused scope.** One new file, one config addition, one new Promotion's worth of seed data. Nothing unrelated.

**8. No unnecessary infrastructure.** No new action, no new entity, no group-membership-management scheme (the rejected alternative in `architecture.md`) - confirmed by reading the actual files.

## DBA-skip verification

Independently confirmed: `src/migrations/` still contains only the first feature's migration, and `PRAGMA table_info(promotion)` shows the original 13 columns with no addition. The DBA stage's decision to skip itself was correct.

## Findings

None blocking. Same informational note as the shipping feature: the `Promotion` row was created by direct database insert rather than through the Admin API, disclosed in `implementation.md` and independently confirmed to be functionally identical to what that mutation would have produced.

One additional observation worth carrying forward (not a defect in this feature): `implementation.md` noted that `setCustomerForOrder` alone doesn't trigger promotion recalculation - only a subsequent price-affecting mutation does. I independently observed the same behavior. This is general Vendure order-recalculation behavior, not specific to this condition, but worth the team knowing if a future feature ever assumes promotions recalculate on every order field change.

## Verdict

```
PASS
```
