import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiInsightsAndNotificationOutbox1783900000000 implements MigrationInterface {
  name = 'CreateAiInsightsAndNotificationOutbox1783900000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "notification_outbox_status_enum" AS ENUM('pending','processing','sent','failed')`,
    );
    await queryRunner.query(`CREATE TABLE "quiz_weakness_insights" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quiz_id" uuid NOT NULL, "teacher_id" uuid NOT NULL,
      "provider_id" uuid NOT NULL, "status" "ai_generation_jobs_status_enum" NOT NULL DEFAULT 'pending',
      "summary" text, "strengths" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "weaknesses" jsonb NOT NULL DEFAULT '[]'::jsonb, "recommendations" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "sample_size" integer NOT NULL DEFAULT 0, "reserved_credits" integer NOT NULL DEFAULT 0,
      "charged_credits" integer NOT NULL DEFAULT 0, "error_message" text, "generated_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_quiz_weakness_insights" PRIMARY KEY ("id"),
      CONSTRAINT "FK_quiz_weakness_insights_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_quiz_weakness_insights_teacher" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_quiz_weakness_insights_provider" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_weakness_insights_quiz_id" ON "quiz_weakness_insights" ("quiz_id")`,
    );
    await queryRunner.query(`CREATE TABLE "notification_outbox" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" varchar(80) NOT NULL,
      "recipient_user_id" uuid, "recipient_email" varchar(320) NOT NULL, "payload" jsonb NOT NULL,
      "status" "notification_outbox_status_enum" NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT 0,
      "max_attempts" integer NOT NULL DEFAULT 5, "dedupe_key" varchar(240) NOT NULL,
      "last_error" text, "available_at" timestamptz NOT NULL DEFAULT now(), "sent_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_notification_outbox" PRIMARY KEY ("id"), CONSTRAINT "UQ_notification_outbox_dedupe_key" UNIQUE ("dedupe_key"),
      CONSTRAINT "FK_notification_outbox_user" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_outbox_status" ON "notification_outbox" ("status")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_outbox"`);
    await queryRunner.query(`DROP TABLE "quiz_weakness_insights"`);
    await queryRunner.query(`DROP TYPE "notification_outbox_status_enum"`);
  }
}
