import {MigrationInterface, QueryRunner} from "typeorm";

export class AddCustomerGilTest1787549554034 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "temporary_customer" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "title" varchar, "firstName" varchar NOT NULL, "lastName" varchar NOT NULL, "phoneNumber" varchar, "emailAddress" varchar NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer, "customFieldsGiltest" integer, CONSTRAINT "REL_3f62b42ed23958b120c235f74d" UNIQUE ("userId"), CONSTRAINT "FK_3f62b42ed23958b120c235f74df" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "temporary_customer"("createdAt", "updatedAt", "deletedAt", "title", "firstName", "lastName", "phoneNumber", "emailAddress", "id", "userId") SELECT "createdAt", "updatedAt", "deletedAt", "title", "firstName", "lastName", "phoneNumber", "emailAddress", "id", "userId" FROM "customer"`, undefined);
        await queryRunner.query(`DROP TABLE "customer"`, undefined);
        await queryRunner.query(`ALTER TABLE "temporary_customer" RENAME TO "customer"`, undefined);
        // Per architecture.md: backfill every existing customer's GilTest to 9999
        // as part of this same migration, rather than a separate ad-hoc script.
        await queryRunner.query(`UPDATE "customer" SET "customFieldsGiltest" = 9999`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "customer" RENAME TO "temporary_customer"`, undefined);
        await queryRunner.query(`CREATE TABLE "customer" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "title" varchar, "firstName" varchar NOT NULL, "lastName" varchar NOT NULL, "phoneNumber" varchar, "emailAddress" varchar NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer, CONSTRAINT "REL_3f62b42ed23958b120c235f74d" UNIQUE ("userId"), CONSTRAINT "FK_3f62b42ed23958b120c235f74df" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "customer"("createdAt", "updatedAt", "deletedAt", "title", "firstName", "lastName", "phoneNumber", "emailAddress", "id", "userId") SELECT "createdAt", "updatedAt", "deletedAt", "title", "firstName", "lastName", "phoneNumber", "emailAddress", "id", "userId" FROM "temporary_customer"`, undefined);
        await queryRunner.query(`DROP TABLE "temporary_customer"`, undefined);
   }

}
