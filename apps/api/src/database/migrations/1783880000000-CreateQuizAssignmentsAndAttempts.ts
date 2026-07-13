import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuizAssignmentsAndAttempts1783880000000 implements MigrationInterface {
  name = 'CreateQuizAssignmentsAndAttempts1783880000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "quiz_assignments_target_type_enum" AS ENUM('classroom','student')`,
    );
    await queryRunner.query(
      `CREATE TYPE "quiz_attempts_status_enum" AS ENUM('in_progress','submitted','expired')`,
    );
    await queryRunner.query(`CREATE TABLE "quiz_assignments" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quiz_id" uuid NOT NULL,
      "target_type" "quiz_assignments_target_type_enum" NOT NULL,
      "classroom_id" uuid, "student_id" uuid, "assigned_by" uuid NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_quiz_assignments" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_quiz_assignments_target" CHECK (("target_type"='classroom' AND "classroom_id" IS NOT NULL AND "student_id" IS NULL) OR ("target_type"='student' AND "student_id" IS NOT NULL AND "classroom_id" IS NULL)),
      CONSTRAINT "FK_quiz_assignments_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_quiz_assignments_classroom" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_quiz_assignments_student" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_quiz_assignments_assigner" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_assignments_quiz_id" ON "quiz_assignments" ("quiz_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quiz_assignments_quiz_classroom" ON "quiz_assignments" ("quiz_id","classroom_id") WHERE "target_type"='classroom'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quiz_assignments_quiz_student" ON "quiz_assignments" ("quiz_id","student_id") WHERE "target_type"='student'`,
    );
    await queryRunner.query(`CREATE TABLE "quiz_attempts" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quiz_id" uuid NOT NULL, "user_id" uuid,
      "guest_token" varchar(64), "guest_name" varchar(120), "attempt_number" integer NOT NULL,
      "status" "quiz_attempts_status_enum" NOT NULL DEFAULT 'in_progress',
      "started_at" timestamptz NOT NULL DEFAULT now(), "submitted_at" timestamptz,
      "expires_at" timestamptz, "score" numeric(10,2), "max_score" numeric(10,2) NOT NULL,
      "time_taken_seconds" integer,
      CONSTRAINT "PK_quiz_attempts" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_quiz_attempts_identity" CHECK (("user_id" IS NOT NULL AND "guest_token" IS NULL AND "guest_name" IS NULL) OR ("user_id" IS NULL AND "guest_token" IS NOT NULL AND "guest_name" IS NOT NULL)),
      CONSTRAINT "FK_quiz_attempts_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_quiz_attempts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_attempts_quiz_id" ON "quiz_attempts" ("quiz_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_attempts_quiz_user" ON "quiz_attempts" ("quiz_id","user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_attempts_quiz_guest" ON "quiz_attempts" ("quiz_id","guest_token")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quiz_attempts_in_progress_user" ON "quiz_attempts" ("quiz_id","user_id") WHERE "status"='in_progress' AND "user_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quiz_attempts_in_progress_guest" ON "quiz_attempts" ("quiz_id","guest_token") WHERE "status"='in_progress' AND "guest_token" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE TABLE "quiz_attempt_answers" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "attempt_id" uuid NOT NULL, "question_id" uuid NOT NULL,
      "selected_option_ids" uuid[] NOT NULL DEFAULT '{}', "is_correct" boolean,
      "score_awarded" numeric(10,2) NOT NULL DEFAULT 0, "answered_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_quiz_attempt_answers" PRIMARY KEY ("id"),
      CONSTRAINT "FK_quiz_attempt_answers_attempt" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_quiz_attempt_answers_question" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quiz_attempt_answers_attempt_question" ON "quiz_attempt_answers" ("attempt_id","question_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_attempt_answers_question_id" ON "quiz_attempt_answers" ("question_id")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "quiz_attempt_answers"`);
    await queryRunner.query(`DROP TABLE "quiz_attempts"`);
    await queryRunner.query(`DROP TABLE "quiz_assignments"`);
    await queryRunner.query(`DROP TYPE "quiz_attempts_status_enum"`);
    await queryRunner.query(`DROP TYPE "quiz_assignments_target_type_enum"`);
  }
}
