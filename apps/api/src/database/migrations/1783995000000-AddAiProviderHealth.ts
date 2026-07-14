import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiProviderHealth1783995000000 implements MigrationInterface {
  name = 'AddAiProviderHealth1783995000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "health_status" character varying(16) NOT NULL DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "last_health_latency_ms" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "last_health_checked_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "last_health_error" character varying(500)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP COLUMN "last_health_error"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP COLUMN "last_health_checked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP COLUMN "last_health_latency_ms"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP COLUMN "health_status"`,
    );
  }
}
