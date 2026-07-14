import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuizResultPolicies1783910000000 implements MigrationInterface {
  name = 'AddQuizResultPolicies1783910000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "quizzes_result_release_mode_enum" AS ENUM ('immediately', 'after_due', 'hidden')`,
    );
    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD "result_release_mode" "quizzes_result_release_mode_enum" NOT NULL DEFAULT 'immediately'`,
    );
    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD "show_correct_answers" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD "show_explanations" boolean NOT NULL DEFAULT true`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quizzes" DROP COLUMN "show_explanations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quizzes" DROP COLUMN "show_correct_answers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quizzes" DROP COLUMN "result_release_mode"`,
    );
    await queryRunner.query(`DROP TYPE "quizzes_result_release_mode_enum"`);
  }
}
