import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiVisionDefaultProvider1784600000000 implements MigrationInterface {
  name = 'AddAiVisionDefaultProvider1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "is_vision_default" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "ai_providers" SET "is_vision_default" = true WHERE "is_default" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ai_providers_vision_default" ON "ai_providers" ("is_vision_default") WHERE "is_vision_default" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_ai_providers_vision_default"`);
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP COLUMN "is_vision_default"`,
    );
  }
}
