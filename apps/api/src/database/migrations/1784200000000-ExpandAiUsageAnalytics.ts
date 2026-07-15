import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandAiUsageAnalytics1784200000000 implements MigrationInterface {
  name = 'ExpandAiUsageAnalytics1784200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "status" varchar(30) NOT NULL DEFAULT 'success'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "cache_input_tokens" bigint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "latency_ms" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "http_status" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "finish_reason" varchar(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "error_code" varchar(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" ADD "error_message" varchar(500)`,
    );
    await queryRunner.query(`
      ALTER TABLE "ai_usage_events"
      ADD CONSTRAINT "CHK_ai_usage_events_analytics" CHECK (
        "status" IN ('success', 'failed', 'refused', 'timeout', 'invalid_output')
        AND "cache_input_tokens" >= 0
        AND ("latency_ms" IS NULL OR "latency_ms" >= 0)
        AND ("http_status" IS NULL OR "http_status" BETWEEN 100 AND 599)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_events_status_created_at" ON "ai_usage_events" ("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_events_source_created_at" ON "ai_usage_events" ("source", "created_at")`,
    );

    await queryRunner.query(`CREATE TABLE "ai_usage_budgets" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "name" varchar(120) NOT NULL,
      "scope" varchar(20) NOT NULL,
      "scope_value" varchar(200),
      "period" varchar(20) NOT NULL,
      "limit_usd" numeric(14,4) NOT NULL,
      "warning_percent" integer NOT NULL DEFAULT 80,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_by" uuid,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ai_usage_budgets" PRIMARY KEY ("id"),
      CONSTRAINT "FK_ai_usage_budgets_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "CHK_ai_usage_budgets_values" CHECK (
        "scope" IN ('global', 'provider', 'model', 'source')
        AND "period" IN ('daily', 'monthly')
        AND "limit_usd" > 0
        AND "warning_percent" BETWEEN 1 AND 100
        AND (("scope" = 'global' AND "scope_value" IS NULL) OR ("scope" <> 'global' AND length(trim("scope_value")) > 0))
      )
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_budgets_active" ON "ai_usage_budgets" ("is_active", "scope", "period")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_usage_budgets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ai_usage_events_source_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ai_usage_events_status_created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP CONSTRAINT "CHK_ai_usage_events_analytics"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "error_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "error_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "finish_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "http_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "latency_ms"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "cache_input_tokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_events" DROP COLUMN "status"`,
    );
  }
}
