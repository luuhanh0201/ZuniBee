import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiPdfExtractionReport1785100000000 implements MigrationInterface {
  name = 'AddAiPdfExtractionReport1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD "extraction_report" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_document_pages"
      ADD "failure_category" varchar(30)
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_document_pages"
      DROP CONSTRAINT "CHK_ai_generation_document_pages_method"
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_document_pages"
      ADD CONSTRAINT "CHK_ai_generation_document_pages_method"
      CHECK ("extraction_method" IN ('direct_text','text_layer','local_ocr','ai_pdf','ai_vision'))
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_document_pages"
      ADD CONSTRAINT "CHK_ai_generation_document_pages_failure_category"
      CHECK (
        "failure_category" IS NULL OR
        "failure_category" IN (
          'provider_blocked',
          'provider_timeout',
          'unsupported_input',
          'invalid_output',
          'needs_manual_review'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_document_pages"
      DROP CONSTRAINT "CHK_ai_generation_document_pages_failure_category"
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_document_pages"
      DROP CONSTRAINT "CHK_ai_generation_document_pages_method"
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_document_pages"
      ADD CONSTRAINT "CHK_ai_generation_document_pages_method"
      CHECK ("extraction_method" IN ('direct_text','text_layer','local_ocr','ai_vision'))
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_document_pages"
      DROP COLUMN "failure_category"
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      DROP COLUMN "extraction_report"
    `);
  }
}
