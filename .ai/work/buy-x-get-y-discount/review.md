# Review: Buy X, Get Y at a Discount

No `git diff` available (same pre-existing gap as before). Every claim below was independently re-verified against real source, a fresh `tsc` run, and fresh live checkout sessions I created myself - not the Developer stage's.

## Checklist

**1. Business request satisfaction.** Read `src/promotions/buy-x-get-y-discount-action.ts` and the `promotionOptions` block in `vendure-config.ts` directly - matches architecture exactly. Ran my own fresh checkout (1 Laptop + 4 Wireless Mice, deliberately a different Y quantity than the Developer used) and got `discounts: [{"description":"Buy Laptop Get Mouse 50pct Off","amount":-1899}]` - exactly `0.5 × 1899 (mouse unit price) × 2 (the amountY cap)`, unaffected by the extra 4th mouse. Delivers exactly the "buy X, get Y at a configurable discount, capped and scaled" shape the business asked for.

**2. Reuse of Vendure's extension points.** Confirmed `buyXGetYFreeCondition` is reused completely unchanged (only referenced via `conditions: [...]`, never modified), and the new action mirrors `buyXGetYFreeAction`'s exact structure with one line changed. No parallel discount mechanism.

**3. Preservation of existing behavior.** This is the most important check, since `promotionActions` was set in config for the first time in this project's history (previously left at framework default entirely, unlike `promotionConditions` which had already been touched once). I independently re-ran a completely fresh checkout (new customer, new product, new session) and confirmed the pre-existing `first-order-discount` promotion's `order_percentage_discount` action still fires correctly (`-6200`, exactly 10% of `62000`). The risk did not materialize.

**4. Coherent behavior.** Not a payment lifecycle feature - the relevant check is whether the condition's computed allocation and the action's discount stay in sync, which they do: the discount amount I observed is arithmetically exact against the condition's own `amountY` cap, not an approximation.

**5. Correct registration/configuration.** `promotionOptions.promotionActions: [...defaultPromotionActions, buyXGetYDiscountAction]` confirmed by direct read - correctly includes the defaults, avoiding the array-replacement risk this feature was specifically at risk of (being the first to touch this particular config key).

**6. Test coverage.** No automated framework exists (pre-existing gap). I did not accept the Developer's logged numbers at face value - I deliberately used a different Y quantity (4 instead of 3) in my own independent test specifically to make sure the "capped at 2" behavior wasn't a coincidence of the Developer's exact test numbers, and got the same capped discount amount. That's meaningfully stronger verification than simply re-running the identical scenario would have been.

**7. Focused scope.** One new file, one config addition, one new Promotion's worth of seed data. Nothing unrelated.

**8. No unnecessary infrastructure.** No new condition, no reimplementation of the existing matching/capping logic, no new entity - confirmed by reading the actual files. The deep import (rather than reimplementing `buyXGetYFreeCondition`'s logic) is the leaner choice and was independently confirmed to actually resolve (`tsc --noEmit` passed cleanly on my own re-run).

## DBA-skip verification

Independently confirmed: `src/migrations/` contains only the two prior features' migrations, and `PRAGMA table_info(promotion)` shows the original 13 columns with no addition. The DBA stage's decision to skip itself was correct.

## Findings

None blocking. Same informational note as every prior promotion/shipping feature: the `Promotion` row was created by direct database insert rather than through the Admin API, disclosed in `implementation.md`.

One additional observation worth carrying forward: the deep import of `buyXGetYFreeCondition` from `@vendure/core`'s internal path is a real, if currently low, forward-compatibility risk - flagged clearly in both `architecture.md` and the code's own comment, with a concrete fallback already documented. This is acceptable for now but should be the first thing re-checked if a future `@vendure/core` version upgrade is ever done on this project.

Story 3 (configurability for a different product pair) was reasonably not re-exercised with a second live promotion, per `implementation.md`'s own stated reasoning - the underlying mechanism was already proven for a different feature's condition. I agree this doesn't need independent re-verification here.

## Verdict

```
PASS
```
