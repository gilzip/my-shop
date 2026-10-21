# Schema execution: Back-in-stock waitlist

## Built vs. specified

| Item | Technical PM / Architect asked for | Developer built | Verdict |
|---|---|---|---|
| Table | one record per address waiting for a variant (`architecture.md`: table `waitlist_entry`) | entity `WaitlistEntry` | matches |
| `productVariantId` | integer, not null, **no foreign key** (soft delete makes a cascade useless) | `@EntityId()` column, no relation | matches |
| `emailAddress` | varchar, not null, stored trimmed and lower-cased | `@Column()` string; normalised in the service before every read and write | matches |
| Uniqueness | one row per address per variant (Rule 2) | `@Index(['productVariantId','emailAddress'], {unique:true})` | matches |
| Status column | **none** (a row means "still waiting") | none | matches |
| Customer link | none (email-only identity) | none | matches |
| Extra columns or indexes | none | none | nothing extra |

**No corrections were needed.** No migration had been written by the Developer, as instructed; this stage generated it.

## CustomFields vs. dedicated table

**Dedicated table**, for all of it. A customField is a single column on an existing entity. This feature stores many rows per variant (one per waiting address) with a uniqueness rule and atomic claim-by-delete, which a column cannot provide. A JSON list in a `ProductVariant` custom field was already rejected in `architecture.md` (concurrent joins overwrite each other, no unique constraint, addresses exposed wherever the variant is read).

## Final schema

`waitlist_entry`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | integer, primary key, autoincrement | no | |
| `createdAt` | datetime | no | `datetime('now')` |
| `updatedAt` | datetime | no | `datetime('now')` |
| `emailAddress` | varchar | no | none |
| `productVariantId` | integer | no | none |

Relations: none declared (deliberate). Index: `IDX_8d540fc72938882dfce2138838`, **unique**, on `(productVariantId, emailAddress)`. The leading column serves the two real access patterns, "who waits for variant X" (watcher) and "how many wait for X" (Admin count). There is no query by email alone, so no second index. Not indexed speculatively: nothing else.

## Migration executed

- File: `src/migrations/1792580616387-AddWaitlistEntry.ts`, generated with `vendure migrate --generate AddWaitlistEntry` and **not edited**.
- `up`: `CREATE TABLE "waitlist_entry" (...)` and `CREATE UNIQUE INDEX "IDX_8d540fc72938882dfce2138838" ON "waitlist_entry" ("productVariantId","emailAddress")`. Two statements, nothing else. Unlike the customField migrations, it does **not** rebuild or touch any existing table.
- `down`: `DROP INDEX ...` then `DROP TABLE "waitlist_entry"`.

Evidence it applies cleanly:

| Check | Result |
|---|---|
| Backup taken first | copy of `vendure.sqlite` before migrating (kept in the session scratchpad) |
| No server on port 3000 / nothing holding the database | confirmed before running |
| `vendure migrate --run` | `Successfully ran 1 migrations` |
| Real table and index in the database | `waitlist_entry` has exactly the five columns above; the unique index exists; 0 rows |
| `migrations` table | latest row `AddWaitlistEntry1792580616387` |
| **Drift check** (`migrate --generate DriftCheck --output-dir <scratch>`) | `No changes in database schema were found, so no migration was generated`; 0 files written |
| `src/migrations` | 6 files (5 before, 1 added) |
| `down` reversibility | the two `down` statements were executed on a **copy** of the database: they succeed and the table is gone; the copy was deleted afterwards |

## Risks

- **Backfill:** none. The table is new and empty.
- **Locking:** negligible. Creating an empty table and its index takes no meaningful time on SQLite, and no other table is rewritten.
- **Backward compatibility:** fully additive. Nothing existing reads or writes the table, and the application tolerates its absence only until the plugin's first query, so the migration must run before the new code serves traffic.
- **Orphans:** with no foreign key, a variant hard-deleted directly in the database leaves orphan rows. Variants are soft-deleted in Vendure and cleaned up by event, so this affects only manual database edits. Harmless: nothing can notify for a variant that does not exist.
- **Privacy:** the table stores raw email addresses until a person is notified or removed. A deleted customer's rows are not removed (email-only identity, by design). Already flagged for the business privacy review.
- **Portability:** the unique index and `datetime` defaults are standard; moving to Postgres or MySQL later needs no change to this migration's intent, only its regenerated SQL.

## Living documents

`.ai/schema-overview.md` updated: status date, migration count (five to six), the first custom entity, a `waitlist_entry` section with columns, index and rationale, and the new migration file in the list.

## Noted for the Reviewer (not fixed here)

The Developer's live behaviour (join, duplicates, the three restock routes, claim-and-notify, counts, clean-up on variant deletion) has still never run against a real table. It can run now. Also note that the demo database has no out-of-stock variant: all 88 variants hold 100 units.
