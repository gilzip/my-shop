# Review: Internal Note on Product Variant

No `git diff` is available (this repo isn't under version control yet — a pre-existing gap, unrelated to this feature). In its place, every claim below was independently re-verified against the live source, the live database, and the live running dev server — not taken from `implementation.md` or `schema-execution.md`'s own account.

## Checklist

**1. Business request satisfaction.** The business requirement asks for a place for staff to record internal, non-customer-facing notes per variant. Confirmed live: the Admin API's `ProductVariantCustomFields` type exposes `internalNote: String`, editable through the existing Dashboard variant page (no separate UI needed). This delivers exactly what was asked, nothing adjacent to it.

**2. Reuse of Vendure's extension model.** Re-read `src/vendure-config.ts` directly: the entire change is one `customFields.ProductVariant` entry. No parallel mechanism, no new entity, no new plugin. This is the smallest possible extension using a framework-native pattern, matching the architecture's own design principle.

**3. Preservation of existing behavior.** Read the full `vendure-config.ts` — every other config block (`apiOptions`, `authOptions`, `paymentOptions`, other plugins) is untouched. Read the migration file directly — its `up()`/`down()` touch only `product_variant`, rebuilding it with exactly one added/removed column and re-inserting all existing rows unchanged. Independently confirmed via `PRAGMA table_info(product_variant)`: 13 columns total, all pre-existing ones present and unchanged, plus the one new nullable column. Nothing else in the schema moved.

**4. Coherent behavior across surfaces.** Checked this myself rather than trusting the writeup:
- Admin API: `ProductVariantCustomFields.internalNote` exists as `String`. ✓
- Shop API: the strongly-typed `ProductVariantCustomFields` type does not exist at all (`__type` returns `null`). ✓
- **One nuance worth recording that the architecture doc didn't quite capture**: the Shop API's `ProductVariant.customFields` field itself still exists, but as a generic `JSON` scalar (Vendure's fallback when an entity has zero *public* custom fields, rather than dropping the field entirely). I queried a real variant through it directly (`products { variants { customFields } }` on the Shop API) and it resolves to `null` — so no leak occurs in practice, the behavior exceeds the requirement, but "the field literally does not exist" (as stated in `architecture.md`) is slightly imprecise about *which* field; the typed field is absent, a generic JSON field that resolves to null remains. This doesn't change the verdict, but is worth the team knowing for the next customField feature, so a Shop API consumer doesn't misread `customFields: null` as "nothing to see" without understanding why.

**5. Correct configuration.** `type: 'text'`, `nullable: true`, `public: false`, English label/description — all present exactly as the architecture specified, confirmed by direct file read.

**6. Test coverage.** No automated test suite exists in this project (pre-existing, documented gap). Given that, I did not accept the Developer's manual verification claims at face value — I re-ran the equivalent checks myself independently (DB inspection, live introspection, live query against a real variant) and got the same results. That's the strongest verification available without a test framework, and it holds up. This should still be flagged: the very next feature after this one should either get a real test framework, or explicitly re-justify going without one again.

**7. Focused scope.** The change is exactly: one config addition, one generated migration, one documentation update (`.ai/schema-overview.md`). Nothing unrelated rides along.

**8. No unnecessary infrastructure.** No new entity, plugin, resolver, or UI component was introduced. This is as small as the requirement allows.

## Findings

None blocking. One informational note carried forward (see item 4) for whoever picks up the next customField feature — not a defect in this one.

## Verdict

```
PASS
```
