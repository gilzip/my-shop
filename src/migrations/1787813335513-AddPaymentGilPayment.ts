import {MigrationInterface, QueryRunner} from "typeorm";

export class AddPaymentGilPayment1787813335513 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_d09d285fe1645cd2f0db811e29"`, undefined);
        await queryRunner.query(`CREATE TABLE "temporary_payment" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "method" varchar NOT NULL, "state" varchar NOT NULL, "errorMessage" varchar, "transactionId" varchar, "metadata" text NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "amount" integer NOT NULL, "orderId" integer, "customFieldsGil_payment" integer DEFAULT (99999), CONSTRAINT "FK_d09d285fe1645cd2f0db811e293" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "temporary_payment"("createdAt", "updatedAt", "method", "state", "errorMessage", "transactionId", "metadata", "id", "amount", "orderId") SELECT "createdAt", "updatedAt", "method", "state", "errorMessage", "transactionId", "metadata", "id", "amount", "orderId" FROM "payment"`, undefined);
        await queryRunner.query(`DROP TABLE "payment"`, undefined);
        await queryRunner.query(`ALTER TABLE "temporary_payment" RENAME TO "payment"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d09d285fe1645cd2f0db811e29" ON "payment" ("orderId") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_d09d285fe1645cd2f0db811e29"`, undefined);
        await queryRunner.query(`ALTER TABLE "payment" RENAME TO "temporary_payment"`, undefined);
        await queryRunner.query(`CREATE TABLE "payment" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "method" varchar NOT NULL, "state" varchar NOT NULL, "errorMessage" varchar, "transactionId" varchar, "metadata" text NOT NULL, "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "amount" integer NOT NULL, "orderId" integer, CONSTRAINT "FK_d09d285fe1645cd2f0db811e293" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`, undefined);
        await queryRunner.query(`INSERT INTO "payment"("createdAt", "updatedAt", "method", "state", "errorMessage", "transactionId", "metadata", "id", "amount", "orderId") SELECT "createdAt", "updatedAt", "method", "state", "errorMessage", "transactionId", "metadata", "id", "amount", "orderId" FROM "temporary_payment"`, undefined);
        await queryRunner.query(`DROP TABLE "temporary_payment"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d09d285fe1645cd2f0db811e29" ON "payment" ("orderId") `, undefined);
   }

}
