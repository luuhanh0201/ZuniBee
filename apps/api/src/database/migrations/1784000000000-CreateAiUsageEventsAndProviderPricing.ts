import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiUsageEventsAndProviderPricing1784000000000 implements MigrationInterface {
  name = 'CreateAiUsageEventsAndProviderPricing1784000000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    // NULL = admin chưa cấu hình giá (khác giá 0 của model miễn phí).
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "input_usd_per_1m" numeric(12,6)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "output_usd_per_1m" numeric(12,6)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD CONSTRAINT "CHK_ai_providers_usd_pricing" CHECK (
        ("input_usd_per_1m" IS NULL OR "input_usd_per_1m">=0)
        AND ("output_usd_per_1m" IS NULL OR "output_usd_per_1m">=0)
      )`,
    );
    // Mỗi completion thành công ghi 1 event, snapshot model + đơn giá tại
    // thời điểm gọi để thống kê đúng lịch sử khi provider đổi model/giá.
    await queryRunner.query(`CREATE TABLE "ai_usage_events" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "provider_id" uuid NOT NULL, "provider_name" varchar(120) NOT NULL,
      "model" varchar(200) NOT NULL, "source" varchar(40) NOT NULL,
      "reference_id" uuid, "user_id" uuid,
      "input_tokens" bigint NOT NULL DEFAULT 0, "output_tokens" bigint NOT NULL DEFAULT 0,
      "input_usd_per_1m" numeric(12,6), "output_usd_per_1m" numeric(12,6),
      "cost_usd" numeric(14,8),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ai_usage_events" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_ai_usage_events_tokens" CHECK ("input_tokens">=0 AND "output_tokens">=0),
      CONSTRAINT "FK_ai_usage_events_provider" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "FK_ai_usage_events_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_events_provider_model_created_at" ON "ai_usage_events" ("provider_id", "model", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_events_created_at" ON "ai_usage_events" ("created_at")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_usage_events"`);
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP CONSTRAINT "CHK_ai_providers_usd_pricing"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP COLUMN "output_usd_per_1m"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP COLUMN "input_usd_per_1m"`,
    );
  }
}
