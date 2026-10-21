# Schema Execution: order-gift-message

**Database:** the **demo** copy only, `C:\vendure\my-shop-demo\vendure.sqlite` (SQLite 3.53.2). The main checkout's database was not touched.

## Spec vs. implementation

| Source | Requires | Implemented | Verdict |
|---|---|---|---|
| `technical-discovery.md` / `stories.md` | one optional message per order; existing orders unaffected | column on `order`, nullable, no default | matches |
| `architecture.md` | `customFieldsGiftmessage TEXT NULL` on `order`; 200-character limit enforced by `validate`, not by the column (SQLite ignores `varchar(n)`) | `"customFieldsGiftmessage" text` (no `NOT NULL`, no `DEFAULT`), config `type: 'text'` | matches |
| `implementation.md` | field `Order.giftMessage`, `public: true` | config entry present; Shop introspection shows `OrderCustomFields.giftMessage` | matches |
| Index | none required: no access pattern filters or sorts by the message | none added | matches |

## Migration

`src/migrations/1792591766697-AddOrderGiftMessage.ts`, generated with `vendure migrate -g AddOrderGiftMessage` against the demo configuration.

- **`up`** (12 statements). This is the standard SQLite rebuild of `order`:
  - drop the 4 `order` indexes;
  - `CREATE TABLE "temporary_order"` with the new column;
  - `INSERT … SELECT` of the 19 existing columns (the new column is **not** in the copy, so it stays `NULL`);
  - `DROP "order"`, then rename `temporary_order` to `order`;
  - recreate the 4 indexes.
  - Touches only `order`.
- **`down`: corrected by the DBA.**
  - The generated `down` began with `ALTER TABLE "order" RENAME TO "temporary_order"`.
  - On SQLite ≥ 3.26 (modern `ALTER TABLE` behavior; TypeORM does not set `legacy_alter_table`), that rename **rewrites the foreign keys of every child table to point at `temporary_order`**, and they dangle once it is dropped.
  - On a copy, the generated `down` left **10 tables** (`order_line`, `payment`, `shipping_line`, `surcharge`, `session`, `history_entry`, `order_modification`, `order_promotions_promotion`, `order_fulfillments_fulfillment`, `order_channels_channel`) referencing a missing table, with **957** `foreign_key_check` violations.
  - Rewritten to mirror `up`: create `temporary_order` with the old schema, copy from `order`, drop `order`, then rename `temporary_order` to `order`. The referenced table is never renamed away. A comment in the file explains why.

## Execution evidence

| Check | Result |
|---|---|
| Backup taken first | `demo-before-migration.sqlite` in the session scratchpad |
| Nothing holding the database | demo server on `:3100` stopped first, and the port confirmed free |
| Baseline before | 119 orders; 19 columns; 4 `IDX_` indexes; `foreign_key_check` = **2** (pre-existing: `order_promotions_promotion` rowids 2 and 4 reference a deleted promotion, unrelated to this feature); 6 migrations; Σ`subTotal` = 7,711,212, Σ`shipping` = 54,500 |
| Run | `vendure migrate -r`: "Successfully ran 1 migrations" |
| After | 119 orders; 20 columns; `customFieldsGiftmessage` `TEXT`, nullable, no default; 0 non-null values; the same 4 indexes; `foreign_key_check` = the same 2; 7 migrations (last `AddOrderGiftMessage1792591766697`); totals identical |
| **Drift check** (`migrate -g DriftCheck -o <scratch>`) | "No changes in database schema were found, so no migration was generated"; 0 files written |
| **`down` reversibility, generated version** (on a copy) | table restored, but 10 child tables left dangling, 957 FK violations. **Rejected** |
| **`down` reversibility, corrected version** (on a copy) | 119 orders, 19 columns, no gift column, 4 indexes, no reference to `temporary_order` left, `foreign_key_check` = the baseline 2. **Passes.** Copy deleted afterwards |
| Type check after the edit | `tsc --noEmit` passes |

## Operational notes

- **Locking:** the `order` rebuild copies every order once. With 119 rows it is instant; on a large production table, plan a maintenance window, since SQLite holds a write lock for the duration.
- **Foreign keys:** TypeORM runs migrations with `PRAGMA foreign_keys = OFF` (`BetterSqlite3QueryRunner`), which is why the rebuild is allowed; correctness depends on never renaming a referenced table away (see the correction above).
- **Data:** no existing value is changed; the column is `NULL` for all existing orders.

## Living docs

`.ai/schema-overview.md` is updated with the status line, the custom-field count (six, the first public one), a new row for `order.customFieldsGiftmessage`, and the migration list, including a note on the corrected `down`.

## Finding outside this feature (not changed)

The earlier customField migrations (`AddCustomerGilTest`, `AddCustomerInternalNote`, `AddCustomerDrorCust`, `AddPaymentGilPayment`) were generated the same way. Their `down` methods almost certainly have the same rename-first flaw for tables with children (`customer`, `payment`). **They have not been tested here.** Reverting any of them should be checked on a copy first, or corrected the same way.
