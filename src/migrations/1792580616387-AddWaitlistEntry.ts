import {MigrationInterface, QueryRunner} from "typeorm";

export class AddWaitlistEntry1792580616387 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "waitlist_entry" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "emailAddress" varchar NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "productVariantId" integer NOT NULL)`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8d540fc72938882dfce2138838" ON "waitlist_entry" ("productVariantId", "emailAddress") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_8d540fc72938882dfce2138838"`, undefined);
        await queryRunner.query(`DROP TABLE "waitlist_entry"`, undefined);
   }

}
