import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiGenerationPauseStates1785300000000 implements MigrationInterface {
  name = 'AddAiGenerationPauseStates1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "ai_generation_jobs_status_enum" ADD VALUE IF NOT EXISTS 'pause_requested'`,
    );
    await queryRunner.query(
      `ALTER TYPE "ai_generation_jobs_status_enum" ADD VALUE IF NOT EXISTS 'paused'`,
    );
    await queryRunner.query(
      `ALTER TYPE "ai_generation_jobs_status_enum" ADD VALUE IF NOT EXISTS 'cancelled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL không hỗ trợ DROP VALUE. Đưa job đang dừng về pending rồi tái
    // tạo enum cũ để migration vẫn kiểm thử down -> up được an toàn.
    await queryRunner.query(`
      UPDATE "ai_generation_jobs"
      SET "status" = 'pending'
      WHERE "status" IN ('pause_requested', 'paused', 'cancelled')
    `);
    await queryRunner.query(
      `ALTER TABLE "ai_generation_jobs" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "quiz_weakness_insights" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TYPE "ai_generation_jobs_status_enum" RENAME TO "ai_generation_jobs_status_enum_with_pause"`,
    );
    await queryRunner.query(
      `CREATE TYPE "ai_generation_jobs_status_enum" AS ENUM('pending','running','succeeded','failed')`,
    );
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ALTER COLUMN "status" TYPE "ai_generation_jobs_status_enum"
      USING "status"::text::"ai_generation_jobs_status_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "quiz_weakness_insights"
      ALTER COLUMN "status" TYPE "ai_generation_jobs_status_enum"
      USING "status"::text::"ai_generation_jobs_status_enum"
    `);
    await queryRunner.query(
      `DROP TYPE "ai_generation_jobs_status_enum_with_pause"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_generation_jobs" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "quiz_weakness_insights" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
  }
}
