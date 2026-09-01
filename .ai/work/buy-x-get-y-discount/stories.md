# Stories: Buy X, Get Y at a Discount

## Story 1 — Buying X makes Y available at the configured discount

**User story**
As a customer who buys the qualifying product X, I want the paired product Y to be discounted in my order, so I'm rewarded for buying the combination.

**Business context**
The core capability the business requirement asks for.

**Acceptance criteria**
- Given an order containing at least `amountX` units of a variant in the promotion's `variantIdsX` list, and at least one unit of a variant in `variantIdsY`, when the order is priced, then the qualifying Y unit(s) are discounted by the promotion's configured percentage.

**Business rules**
- The discount amount is per-promotion configuration (a percentage), not fixed by these stories.

**Edge cases**
- An order with only Y and no X receives no discount on Y - the condition's existing gating logic already ensures this, this story just confirms it holds once the new action is wired in.

**Dependencies**
None.

**Out of scope**
Any UI beyond the Dashboard's existing generic promotion-configuration rendering.

**Relevant existing capability**
`buyXGetYFreeCondition` already computes exactly which units of Y qualify and in what quantity - this story's new action only needs to apply a partial discount to that already-computed allocation, not recompute eligibility itself.

---

## Story 2 — The discount scales per qualifying unit, not per order

**User story**
As the business, I want every qualifying unit of Y to receive the discount, not just one, so larger qualifying orders are rewarded proportionally.

**Business context**
Directly from the resolved business decision (discount scales per unit, not once per order).

**Acceptance criteria**
- Given an order where the condition's allocation logic qualifies multiple units of Y for the discount, when the order is priced, then the total discount equals the per-unit discount amount multiplied by the number of qualifying units - not a single flat discount regardless of quantity.

**Business rules**
- Scaling follows exactly the same quantity-capping the existing condition already computes (`amountY`-limited) - this story does not ask for unlimited scaling beyond what the condition allows.

**Edge cases**
- If the condition's own capping logic limits how many Y units qualify (e.g. `amountY: 1` per qualifying "buy" multiple), the discount should scale with that computed cap, not with the total quantity of Y in the order regardless of cap.

**Dependencies**
Story 1.

**Out of scope**
Changing the condition's own capping logic - this story only concerns whether the action correctly scales against whatever the condition already computed.

---

## Story 3 — The product pair and discount percentage are configurable per promotion, without new code

**User story**
As merchandising staff, I want to set up a new "buy X get Y at a discount" promotion for a different product pair and discount amount myself, so I don't need an engineering change every time.

**Business context**
Directly from the business requirement's core objective - this is a reusable capability, not a one-off.

**Acceptance criteria**
- Given a new Promotion is configured with different `variantIdsX`/`variantIdsY`/`amountX`/`amountY` values (on the existing condition) and a different discount percentage (on the new action), when an order matches that new configuration, then it behaves correctly for the new pair/amount without any code change.

**Business rules**
None beyond configurability itself.

**Edge cases**
None beyond what Story 1/2 already cover for a single configuration.

**Dependencies**
Story 1.

**Out of scope**
Any limit on how many such promotions can exist simultaneously - not addressed by this requirement.

---

## Story 4 — Existing promotion behavior is completely unaffected

**User story**
As the business, I want the existing free `buyXGetYFreeAction`-based promotions (and every other existing promotion action) to keep working exactly as before, so adding this new action doesn't break anything already running.

**Business context**
The same category of regression risk flagged in every prior feature that touches a `promotionOptions`/`shippingOptions` config array.

**Acceptance criteria**
- Given the new action is registered, when any existing built-in promotion action (including `buyXGetYFreeAction` itself, if used by another promotion) is exercised, then it continues to function exactly as before.

**Business rules**
None beyond "no regression."

**Edge cases**
None beyond the acceptance criteria.

**Dependencies**
None, but should be verified alongside Stories 1-3.

**Out of scope**
Any improvement to the existing built-in actions.
