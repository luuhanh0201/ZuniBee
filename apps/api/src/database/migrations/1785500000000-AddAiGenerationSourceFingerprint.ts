import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiGenerationSourceFingerprint1785500000000 implements MigrationInterface {
  name = 'AddAiGenerationSourceFingerprint1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_generation_jobs" ADD "source_sha256" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_generation_jobs" DROP COLUMN "source_sha256"`,
    );
  }
}
