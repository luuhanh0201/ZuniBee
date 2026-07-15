import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiGenerationDocumentProgress1784700000000 implements MigrationInterface {
  name = 'AddAiGenerationDocumentProgress1784700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD "stage" varchar(30) NOT NULL DEFAULT 'queued',
      ADD "document_total_pages" integer,
      ADD "document_processed_pages" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      UPDATE "ai_generation_jobs"
      SET "stage" = CASE
        WHEN "status" = 'succeeded' THEN 'completed'
        WHEN "status" = 'failed' THEN 'failed'
        WHEN "status" = 'running' THEN 'generating_quiz'
        ELSE 'queued'
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD CONSTRAINT "CHK_ai_generation_jobs_stage"
        CHECK ("stage" IN ('queued','reading_document','generating_quiz','saving_quiz','completed','failed')),
      ADD CONSTRAINT "CHK_ai_generation_jobs_document_progress"
        CHECK (
          "document_processed_pages" >= 0
          AND ("document_total_pages" IS NULL OR "document_total_pages" >= 1)
          AND (
            "document_total_pages" IS NULL
            OR "document_processed_pages" <= "document_total_pages"
          )
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      DROP CONSTRAINT "CHK_ai_generation_jobs_document_progress",
      DROP CONSTRAINT "CHK_ai_generation_jobs_stage",
      DROP COLUMN "document_processed_pages",
      DROP COLUMN "document_total_pages",
      DROP COLUMN "stage"
    `);
  }
}
