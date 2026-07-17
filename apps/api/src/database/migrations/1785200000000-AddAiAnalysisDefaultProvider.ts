import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiAnalysisDefaultProvider1785200000000 implements MigrationInterface {
  name = 'AddAiAnalysisDefaultProvider1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "is_analysis_default" boolean NOT NULL DEFAULT false`,
    );
    // Không backfill: provider analysis rỗng nghĩa là phân tích chunk vẫn chạy
    // trên provider quiz như trước, nên hệ thống đang chạy không đổi hành vi.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ai_providers_analysis_default" ON "ai_providers" ("is_analysis_default") WHERE "is_analysis_default" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_generation_jobs" ADD "analysis_provider_id" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_generation_jobs" DROP COLUMN "analysis_provider_id"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_ai_providers_analysis_default"`);
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP COLUMN "is_analysis_default"`,
    );
  }
}
