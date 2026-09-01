import {MigrationInterface, QueryRunner} from "typeorm";

export class AddProductVariantInternalNote1787489491389 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_6e420052844edf3a5506d863ce"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_e38dca0d82fd64c7cf8aac8b8e"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_0e6f516053cf982b537836e21c"`, undefined);
        await queryRunner.query(`CREATE TABLE "temporary_product_variant" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "enabled" boolean NOT NULL DEFAULT (1), "sku" varchar NOT NULL, "outOfStockThreshold" integer NOT NULL DEFAULT (0), "useGlobalOutOfStockThreshold" boolean NOT NULL DEFAULT (1), "trackInventory" varchar NOT NULL DEFAULT ('INHERIT'), "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "featuredAssetId" integer, "taxCategoryId" integer, "productId" integer, "customFieldsInternalnote" text, CONSTRAINT "FK_6e420052844edf3a5506d863ce6" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_e38dca0d82fd64c7cf8aac8b8ef" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_0e6f516053cf982b537836e21cf" FOREIGN KEY ("featuredAssetId") REFERENCES "asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "temporary_product_variant"("createdAt", "updatedAt", "deletedAt", "enabled", "sku", "outOfStockThreshold", "useGlobalOutOfStockThreshold", "trackInventory", "id", "featuredAssetId", "taxCategoryId", "productId") SELECT "createdAt", "updatedAt", "deletedAt", "enabled", "sku", "outOfStockThreshold", "useGlobalOutOfStockThreshold", "trackInventory", "id", "featuredAssetId", "taxCategoryId", "productId" FROM "product_variant"`, undefined);
        await queryRunner.query(`DROP TABLE "product_variant"`, undefined);
        await queryRunner.query(`ALTER TABLE "temporary_product_variant" RENAME TO "product_variant"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_6e420052844edf3a5506d863ce" ON "product_variant" ("productId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_e38dca0d82fd64c7cf8aac8b8e" ON "product_variant" ("taxCategoryId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_0e6f516053cf982b537836e21c" ON "product_variant" ("featuredAssetId") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_0e6f516053cf982b537836e21c"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_e38dca0d82fd64c7cf8aac8b8e"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_6e420052844edf3a5506d863ce"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" RENAME TO "temporary_product_variant"`, undefined);
        await queryRunner.query(`CREATE TABLE "product_variant" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "enabled" boolean NOT NULL DEFAULT (1), "sku" varchar NOT NULL, "outOfStockThreshold" integer NOT NULL DEFAULT (0), "useGlobalOutOfStockThreshold" boolean NOT NULL DEFAULT (1), "trackInventory" varchar NOT NULL DEFAULT ('INHERIT'), "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "featuredAssetId" integer, "taxCategoryId" integer, "productId" integer, CONSTRAINT "FK_6e420052844edf3a5506d863ce6" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_e38dca0d82fd64c7cf8aac8b8ef" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_0e6f516053cf982b537836e21cf" FOREIGN KEY ("featuredAssetId") REFERENCES "asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "product_variant"("createdAt", "updatedAt", "deletedAt", "enabled", "sku", "outOfStockThreshold", "useGlobalOutOfStockThreshold", "trackInventory", "id", "featuredAssetId", "taxCategoryId", "productId") SELECT "createdAt", "updatedAt", "deletedAt", "enabled", "sku", "outOfStockThreshold", "useGlobalOutOfStockThreshold", "trackInventory", "id", "featuredAssetId", "taxCategoryId", "productId" FROM "temporary_product_variant"`, undefined);
        await queryRunner.query(`DROP TABLE "temporary_product_variant"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_0e6f516053cf982b537836e21c" ON "product_variant" ("featuredAssetId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_e38dca0d82fd64c7cf8aac8b8e" ON "product_variant" ("taxCategoryId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_6e420052844edf3a5506d863ce" ON "product_variant" ("productId") `, undefined);
   }

}
