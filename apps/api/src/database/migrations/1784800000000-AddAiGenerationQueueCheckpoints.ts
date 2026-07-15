import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiGenerationQueueCheckpoints1784800000000 implements MigrationInterface {
  name = 'AddAiGenerationQueueCheckpoints1784800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      DROP CONSTRAINT "CHK_ai_generation_jobs_stage",
      ADD "vision_provider_id" uuid,
      ADD "generation_total_chunks" integer,
      ADD "generation_processed_chunks" integer NOT NULL DEFAULT 0,
      ADD "source_storage_key" varchar(500),
      ADD "source_original_name" varchar(255),
      ADD "source_mime_type" varchar(150),
      ADD "source_size" integer,
      ADD "attempt_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD CONSTRAINT "FK_ai_generation_jobs_vision_provider"
        FOREIGN KEY ("vision_provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL,
      ADD CONSTRAINT "CHK_ai_generation_jobs_stage"
        CHECK ("stage" IN (
          'queued','reading_document','generating_candidates',
          'selecting_questions','generating_quiz','saving_quiz','completed','failed'
        )),
      ADD CONSTRAINT "CHK_ai_generation_jobs_chunk_progress"
        CHECK (
          "generation_processed_chunks" >= 0
          AND ("generation_total_chunks" IS NULL OR "generation_total_chunks" >= 1)
          AND (
            "generation_total_chunks" IS NULL
            OR "generation_processed_chunks" <= "generation_total_chunks"
          )
        )
    `);
    await queryRunner.query(`
      CREATE TABLE "ai_generation_document_pages" (
        "job_id" uuid NOT NULL,
        "page_number" integer NOT NULL,
        "text" text NOT NULL,
        "extraction_method" varchar(20) NOT NULL,
        "confidence" real,
        "vision_input_tokens" integer NOT NULL DEFAULT 0,
        "vision_output_tokens" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_generation_document_pages" PRIMARY KEY ("job_id", "page_number"),
        CONSTRAINT "FK_ai_generation_document_pages_job"
          FOREIGN KEY ("job_id") REFERENCES "ai_generation_jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_ai_generation_document_pages_number" CHECK ("page_number" >= 1),
        CONSTRAINT "CHK_ai_generation_document_pages_method"
          CHECK ("extraction_method" IN ('direct_text','text_layer','local_ocr','ai_vision'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_generation_document_pages_job"
      ON "ai_generation_document_pages" ("job_id")
    `);
    await queryRunner.query(`
      CREATE TABLE "ai_generation_chunks" (
        "job_id" uuid NOT NULL,
        "chunk_index" integer NOT NULL,
        "start_page" integer,
        "end_page" integer,
        "text" text NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "candidate_questions" jsonb,
        "input_tokens" integer NOT NULL DEFAULT 0,
        "output_tokens" integer NOT NULL DEFAULT 0,
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_generation_chunks" PRIMARY KEY ("job_id", "chunk_index"),
        CONSTRAINT "FK_ai_generation_chunks_job"
          FOREIGN KEY ("job_id") REFERENCES "ai_generation_jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_ai_generation_chunks_index" CHECK ("chunk_index" >= 0),
        CONSTRAINT "CHK_ai_generation_chunks_status"
          CHECK ("status" IN ('pending','processing','completed','failed'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_generation_chunks_job"
      ON "ai_generation_chunks" ("job_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_generation_chunks"`);
    await queryRunner.query(`DROP TABLE "ai_generation_document_pages"`);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      DROP CONSTRAINT "CHK_ai_generation_jobs_chunk_progress",
      DROP CONSTRAINT "CHK_ai_generation_jobs_stage",
      DROP CONSTRAINT "FK_ai_generation_jobs_vision_provider",
      DROP COLUMN "attempt_count",
      DROP COLUMN "source_size",
      DROP COLUMN "source_mime_type",
      DROP COLUMN "source_original_name",
      DROP COLUMN "source_storage_key",
      DROP COLUMN "generation_processed_chunks",
      DROP COLUMN "generation_total_chunks",
      DROP COLUMN "vision_provider_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD CONSTRAINT "CHK_ai_generation_jobs_stage"
        CHECK ("stage" IN ('queued','reading_document','generating_quiz','saving_quiz','completed','failed'))
    `);
  }
}
