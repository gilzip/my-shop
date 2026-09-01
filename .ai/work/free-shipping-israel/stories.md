# Stories: Free Shipping for Israel Orders Over 200 ILS

## Story 1 — A qualifying Israeli order sees Free Shipping as an option

**User story**
As a customer shipping to Israel with an order subtotal of 200 ILS or more, I want to see a Free Shipping option at checkout, so I'm rewarded for reaching that spending level.

**Business context**
This is the core capability the business requirement asks for.

**Acceptance criteria**
- Given a shipping address with country Israel and an order subtotal of exactly 200 ILS, when eligible shipping methods are requested at checkout, then Free Shipping appears among them with a price of 0.
- Given the same address and a subtotal above 200 ILS, when eligible shipping methods are requested, then Free Shipping still appears.
- Given a shipping address with country Israel and a subtotal below 200 ILS, when eligible shipping methods are requested, then Free Shipping does not appear.

**Business rules**
- The threshold is 200 ILS (20000 in the system's minor-unit representation), inclusive — exactly 200 qualifies.
- Eligibility does not remove any other shipping option the customer would otherwise see.

**Edge cases**
- An order with no shipping address set yet must not error when eligibility is evaluated — it should simply be treated as not eligible.
- A subtotal calculated with tax included/excluded should use whichever total field already represents "order subtotal with tax" consistently with how the existing default checker computes it, so behavior is consistent with the rest of the system rather than introducing a second convention.

**Dependencies**
None.

**Out of scope**
Any UI/wording beyond what the storefront already renders generically for available shipping methods.

**Relevant existing capability**
Vendure's `defaultShippingEligibilityChecker` already does a subtotal-threshold check — this story adds a destination condition on top of that same pattern, not a new mechanism.

---

## Story 2 — Orders outside Israel are never offered Free Shipping

**User story**
As the business, I want to guarantee Free Shipping never appears for orders shipping outside Israel, regardless of order size, so the offer stays scoped to the market it's intended for.

**Business context**
Directly from the business requirement's Target User section — this is a hard boundary, not a tunable preference.

**Acceptance criteria**
- Given a shipping address in any country other than Israel, when eligible shipping methods are requested for any subtotal (including very large orders), then Free Shipping does not appear.

**Business rules**
- No exceptions by country, customer tier, or order size override this.

**Edge cases**
- A shipping address with a missing or malformed country code must not be treated as a match for Israel by default — absence of a valid match means not eligible, not an error and not a fallback to eligible.

**Dependencies**
Story 1 (the checker must exist to verify what it excludes).

**Out of scope**
None beyond what's stated.

---

## Story 3 — Existing shipping methods are completely unaffected

**User story**
As the business, I want Standard Shipping and Express Shipping to keep working exactly as they do today, so introducing Free Shipping doesn't quietly break or change pricing for existing shipping options.

**Business context**
Not customer-facing on its own, but a hard condition of this feature being considered safe to ship — discovery specifically flagged a real risk here (how Vendure merges shipping configuration arrays) that must be explicitly verified, not assumed away.

**Acceptance criteria**
- Given any order (any destination, any subtotal), when eligible shipping methods are requested, then Standard Shipping and Express Shipping both still appear, both still unconditionally eligible, and both still priced exactly as before (5.00 ILS and 10.00 ILS respectively).

**Business rules**
None beyond "no regression" — this story exists specifically to make that testable rather than assumed.

**Edge cases**
None beyond the acceptance criteria — this is a regression check, not new behavior.

**Dependencies**
None, but should be verified together with Story 1/2 since all three are affected by the same configuration change.

**Out of scope**
Any improvement to Standard/Express Shipping themselves — they are explicitly out of scope for modification.
