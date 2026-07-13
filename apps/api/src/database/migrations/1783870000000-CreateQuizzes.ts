import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuizzes1783870000000 implements MigrationInterface {
  name = 'CreateQuizzes1783870000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "quizzes_status_enum" AS ENUM('draft','published')`,
    );
    await queryRunner.query(
      `CREATE TYPE "quizzes_visibility_enum" AS ENUM('private_class','assigned','public')`,
    );
    await queryRunner.query(
      `CREATE TYPE "quizzes_leaderboard_mode_enum" AS ENUM('hidden','visible_anonymized')`,
    );
    await queryRunner.query(
      `CREATE TYPE "quiz_questions_type_enum" AS ENUM('single_choice','true_false','multiple_choice')`,
    );
    await queryRunner.query(`CREATE TABLE "quizzes" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL,
      "title" varchar(200) NOT NULL, "description" text,
      "status" "quizzes_status_enum" NOT NULL DEFAULT 'draft',
      "total_score" smallint NOT NULL DEFAULT 10,
      "time_limit_seconds" integer, "opens_at" timestamptz, "due_at" timestamptz,
      "max_attempts" integer,
      "visibility" "quizzes_visibility_enum" NOT NULL DEFAULT 'private_class',
      "leaderboard_mode" "quizzes_leaderboard_mode_enum" NOT NULL DEFAULT 'hidden',
      "answers_changed_at" timestamptz, "last_regraded_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_quizzes" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_quizzes_total_score" CHECK ("total_score" IN (10,100,1000)),
      CONSTRAINT "CHK_quizzes_time_limit" CHECK ("time_limit_seconds" IS NULL OR "time_limit_seconds" > 0),
      CONSTRAINT "CHK_quizzes_max_attempts" CHECK ("max_attempts" IS NULL OR "max_attempts" > 0),
      CONSTRAINT "CHK_quizzes_dates" CHECK ("opens_at" IS NULL OR "due_at" IS NULL OR "due_at" > "opens_at"),
      CONSTRAINT "FK_quizzes_teacher" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_quizzes_teacher_id" ON "quizzes" ("teacher_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quizzes_visibility" ON "quizzes" ("visibility")`,
    );
    await queryRunner.query(`CREATE TABLE "quiz_questions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quiz_id" uuid NOT NULL,
      "type" "quiz_questions_type_enum" NOT NULL, "content" text NOT NULL,
      "explanation" text, "show_explanation" boolean NOT NULL DEFAULT true,
      "score" numeric(10,2) NOT NULL DEFAULT 0, "display_order" integer NOT NULL,
      CONSTRAINT "PK_quiz_questions" PRIMARY KEY ("id"),
      CONSTRAINT "FK_quiz_questions_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quiz_questions_quiz_order" ON "quiz_questions" ("quiz_id","display_order")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_questions_quiz_id" ON "quiz_questions" ("quiz_id")`,
    );
    await queryRunner.query(`CREATE TABLE "quiz_question_options" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "question_id" uuid NOT NULL,
      "content" text NOT NULL, "is_correct" boolean NOT NULL DEFAULT false,
      "display_order" integer NOT NULL,
      CONSTRAINT "PK_quiz_question_options" PRIMARY KEY ("id"),
      CONSTRAINT "FK_quiz_question_options_question" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quiz_question_options_question_order" ON "quiz_question_options" ("question_id","display_order")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_question_options_question_id" ON "quiz_question_options" ("question_id")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "quiz_question_options"`);
    await queryRunner.query(`DROP TABLE "quiz_questions"`);
    await queryRunner.query(`DROP TABLE "quizzes"`);
    await queryRunner.query(`DROP TYPE "quiz_questions_type_enum"`);
    await queryRunner.query(`DROP TYPE "quizzes_leaderboard_mode_enum"`);
    await queryRunner.query(`DROP TYPE "quizzes_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "quizzes_status_enum"`);
  }
}
