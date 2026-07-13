import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiGenerationAndCredits1783890000000 implements MigrationInterface {
  name = 'CreateAiGenerationAndCredits1783890000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ai_providers_kind_enum" AS ENUM('ollama','openai_compatible')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ai_credit_ledger_kind_enum" AS ENUM('grant','reserve','consume','release')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ai_generation_jobs_status_enum" AS ENUM('pending','running','succeeded','failed')`,
    );
    await queryRunner.query(`CREATE TABLE "ai_providers" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" varchar(120) NOT NULL,
      "kind" "ai_providers_kind_enum" NOT NULL, "base_url" varchar(500) NOT NULL,
      "model" varchar(200) NOT NULL, "encrypted_api_key" text,
      "is_active" boolean NOT NULL DEFAULT true, "is_default" boolean NOT NULL DEFAULT false,
      "base_credit_cost" integer NOT NULL DEFAULT 1, "credit_cost_per_1k_tokens" integer NOT NULL DEFAULT 1,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ai_providers" PRIMARY KEY ("id"), CONSTRAINT "UQ_ai_providers_name" UNIQUE ("name"),
      CONSTRAINT "CHK_ai_providers_cost" CHECK ("base_credit_cost">=0 AND "credit_cost_per_1k_tokens">=0)
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ai_providers_default" ON "ai_providers" ("is_default") WHERE "is_default"=true`,
    );
    await queryRunner.query(`CREATE TABLE "ai_credit_accounts" (
      "user_id" uuid NOT NULL, "balance" integer NOT NULL DEFAULT 0, "reserved" integer NOT NULL DEFAULT 0,
      "updated_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_ai_credit_accounts" PRIMARY KEY ("user_id"),
      CONSTRAINT "CHK_ai_credit_accounts_non_negative" CHECK ("balance">=0 AND "reserved">=0 AND "reserved"<="balance"),
      CONSTRAINT "FK_ai_credit_accounts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE "ai_credit_ledger" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL,
      "kind" "ai_credit_ledger_kind_enum" NOT NULL, "amount" integer NOT NULL,
      "balance_after" integer NOT NULL, "reserved_after" integer NOT NULL,
      "reference_type" varchar(60) NOT NULL, "reference_id" uuid NOT NULL,
      "idempotency_key" varchar(180) NOT NULL, "note" text, "created_by" uuid,
      "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_ai_credit_ledger" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_ai_credit_ledger_idempotency_key" UNIQUE ("idempotency_key"),
      CONSTRAINT "CHK_ai_credit_ledger_amount" CHECK ("amount">0),
      CONSTRAINT "FK_ai_credit_ledger_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_ai_credit_ledger_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_credit_ledger_user_id" ON "ai_credit_ledger" ("user_id")`,
    );
    await queryRunner.query(`CREATE TABLE "ai_generation_jobs" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "provider_id" uuid NOT NULL,
      "quiz_id" uuid, "status" "ai_generation_jobs_status_enum" NOT NULL DEFAULT 'pending',
      "request_payload" jsonb NOT NULL, "reserved_credits" integer NOT NULL, "charged_credits" integer NOT NULL DEFAULT 0,
      "input_tokens" integer NOT NULL DEFAULT 0, "output_tokens" integer NOT NULL DEFAULT 0,
      "error_message" text, "completed_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ai_generation_jobs" PRIMARY KEY ("id"),
      CONSTRAINT "FK_ai_generation_jobs_teacher" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_ai_generation_jobs_provider" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "FK_ai_generation_jobs_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_generation_jobs_teacher_id" ON "ai_generation_jobs" ("teacher_id")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_generation_jobs"`);
    await queryRunner.query(`DROP TABLE "ai_credit_ledger"`);
    await queryRunner.query(`DROP TABLE "ai_credit_accounts"`);
    await queryRunner.query(`DROP TABLE "ai_providers"`);
    await queryRunner.query(`DROP TYPE "ai_generation_jobs_status_enum"`);
    await queryRunner.query(`DROP TYPE "ai_credit_ledger_kind_enum"`);
    await queryRunner.query(`DROP TYPE "ai_providers_kind_enum"`);
  }
}
