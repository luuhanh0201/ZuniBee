import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiGenerationJobErrorDetails1785000000000 implements MigrationInterface {
  name = 'AddAiGenerationJobErrorDetails1785000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD "error_details" jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      DROP COLUMN "error_details"
    `);
  }
}
