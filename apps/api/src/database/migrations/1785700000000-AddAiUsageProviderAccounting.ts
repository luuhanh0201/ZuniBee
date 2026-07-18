import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiUsageProviderAccounting1785700000000 implements MigrationInterface {
  name = 'AddAiUsageProviderAccounting1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "cache_write_tokens" bigint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "reasoning_tokens" bigint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "provider_cost_usd" numeric(14,8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "cost_source" character varying(24) NOT NULL DEFAULT 'rate_card_estimate'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "provider_request_id" character varying(250)`,
    );
    await queryRunner.query(
      `UPDATE "ai_usage_events" SET "cost_source" = CASE WHEN "cost_usd" IS NULL THEN 'unavailable' ELSE 'rate_card_estimate' END`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "provider_request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "cost_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "provider_cost_usd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "reasoning_tokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "cache_write_tokens"`,
    );
  }
}
