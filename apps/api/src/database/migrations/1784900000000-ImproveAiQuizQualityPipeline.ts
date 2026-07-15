import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ImproveAiQuizQualityPipeline1784900000000 implements MigrationInterface {
  name = 'ImproveAiQuizQualityPipeline1784900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      DROP CONSTRAINT "CHK_ai_generation_jobs_stage",
      ADD "quiz_blueprint" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD CONSTRAINT "CHK_ai_generation_jobs_stage"
      CHECK ("stage" IN (
        'queued','reading_document','analyzing_document','planning_quiz',
        'generating_candidates','selecting_questions','reviewing_questions',
        'generating_quiz','saving_quiz','completed','failed'
      ))
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_chunks"
      ADD "analysis" jsonb,
      ADD "analysis_input_tokens" integer NOT NULL DEFAULT 0,
      ADD "analysis_output_tokens" integer NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_chunks"
      DROP COLUMN "analysis_output_tokens",
      DROP COLUMN "analysis_input_tokens",
      DROP COLUMN "analysis"
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      DROP CONSTRAINT "CHK_ai_generation_jobs_stage",
      DROP COLUMN "quiz_blueprint"
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD CONSTRAINT "CHK_ai_generation_jobs_stage"
      CHECK ("stage" IN (
        'queued','reading_document','generating_candidates',
        'selecting_questions','generating_quiz','saving_quiz','completed','failed'
      ))
    `);
  }
}
