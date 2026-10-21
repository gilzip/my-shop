import {MigrationInterface, QueryRunner} from "typeorm";

export class AddOrderGiftMessage1792591766697 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_124456e637cca7a415897dce65"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_af13739f4962eab899bdff34be"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_729b3eea7ce540930dbb706949"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_73a78d7df09541ac5eba620d18"`, undefined);
        await queryRunner.query(`CREATE TABLE "temporary_order" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "type" varchar NOT NULL DEFAULT ('Regular'), "code" varchar NOT NULL, "state" varchar NOT NULL, "active" boolean NOT NULL DEFAULT (1), "orderPlacedAt" datetime, "couponCodes" text NOT NULL, "shippingAddress" text NOT NULL, "billingAddress" text NOT NULL, "currencyCode" varchar NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "aggregateOrderId" integer, "customerId" integer, "taxZoneId" integer, "subTotal" integer NOT NULL, "subTotalWithTax" integer NOT NULL, "shipping" integer NOT NULL DEFAULT (0), "shippingWithTax" integer NOT NULL DEFAULT (0), "customFieldsGiftmessage" text, CONSTRAINT "FK_124456e637cca7a415897dce659" FOREIGN KEY ("customerId") REFERENCES "customer" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_73a78d7df09541ac5eba620d181" FOREIGN KEY ("aggregateOrderId") REFERENCES "order" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "temporary_order"("createdAt", "updatedAt", "type", "code", "state", "active", "orderPlacedAt", "couponCodes", "shippingAddress", "billingAddress", "currencyCode", "id", "aggregateOrderId", "customerId", "taxZoneId", "subTotal", "subTotalWithTax", "shipping", "shippingWithTax") SELECT "createdAt", "updatedAt", "type", "code", "state", "active", "orderPlacedAt", "couponCodes", "shippingAddress", "billingAddress", "currencyCode", "id", "aggregateOrderId", "customerId", "taxZoneId", "subTotal", "subTotalWithTax", "shipping", "shippingWithTax" FROM "order"`, undefined);
        await queryRunner.query(`DROP TABLE "order"`, undefined);
        await queryRunner.query(`ALTER TABLE "temporary_order" RENAME TO "order"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_124456e637cca7a415897dce65" ON "order" ("customerId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_af13739f4962eab899bdff34be" ON "order" ("orderPlacedAt") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_729b3eea7ce540930dbb706949" ON "order" ("code") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_73a78d7df09541ac5eba620d18" ON "order" ("aggregateOrderId") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_73a78d7df09541ac5eba620d18"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_729b3eea7ce540930dbb706949"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_af13739f4962eab899bdff34be"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_124456e637cca7a415897dce65"`, undefined);
        // DBA correction: the generated down renamed "order" to "temporary_order" first. On SQLite >= 3.26
        // that rewrites every child table's REFERENCES to "temporary_order", leaving them dangling once it is
        // dropped (957 foreign_key_check violations in a test). Rebuild into a new table instead, the same
        // pattern as up(), so the referenced "order" table is never renamed away.
        await queryRunner.query(`CREATE TABLE "temporary_order" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "type" varchar NOT NULL DEFAULT ('Regular'), "code" varchar NOT NULL, "state" varchar NOT NULL, "active" boolean NOT NULL DEFAULT (1), "orderPlacedAt" datetime, "couponCodes" text NOT NULL, "shippingAddress" text NOT NULL, "billingAddress" text NOT NULL, "currencyCode" varchar NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "aggregateOrderId" integer, "customerId" integer, "taxZoneId" integer, "subTotal" integer NOT NULL, "subTotalWithTax" integer NOT NULL, "shipping" integer NOT NULL DEFAULT (0), "shippingWithTax" integer NOT NULL DEFAULT (0), CONSTRAINT "FK_124456e637cca7a415897dce659" FOREIGN KEY ("customerId") REFERENCES "customer" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_73a78d7df09541ac5eba620d181" FOREIGN KEY ("aggregateOrderId") REFERENCES "order" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "temporary_order"("createdAt", "updatedAt", "type", "code", "state", "active", "orderPlacedAt", "couponCodes", "shippingAddress", "billingAddress", "currencyCode", "id", "aggregateOrderId", "customerId", "taxZoneId", "subTotal", "subTotalWithTax", "shipping", "shippingWithTax") SELECT "createdAt", "updatedAt", "type", "code", "state", "active", "orderPlacedAt", "couponCodes", "shippingAddress", "billingAddress", "currencyCode", "id", "aggregateOrderId", "customerId", "taxZoneId", "subTotal", "subTotalWithTax", "shipping", "shippingWithTax" FROM "order"`, undefined);
        await queryRunner.query(`DROP TABLE "order"`, undefined);
        await queryRunner.query(`ALTER TABLE "temporary_order" RENAME TO "order"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_73a78d7df09541ac5eba620d18" ON "order" ("aggregateOrderId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_729b3eea7ce540930dbb706949" ON "order" ("code") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_af13739f4962eab899bdff34be" ON "order" ("orderPlacedAt") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_124456e637cca7a415897dce65" ON "order" ("customerId") `, undefined);
   }

}
