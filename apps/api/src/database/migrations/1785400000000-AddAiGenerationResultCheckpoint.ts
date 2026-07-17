import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiGenerationResultCheckpoint1785400000000 implements MigrationInterface {
  name = 'AddAiGenerationResultCheckpoint1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_generation_jobs" ADD "generation_result" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_generation_jobs" DROP COLUMN "generation_result"`,
    );
  }
}
