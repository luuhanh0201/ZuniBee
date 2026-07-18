import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiProviderDriver1785600000000 implements MigrationInterface {
  name = 'AddAiProviderDriver1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "driver" character varying(32) NOT NULL DEFAULT 'openai_compatible'`,
    );
    await queryRunner.query(`
      UPDATE "ai_providers"
      SET "driver" = CASE
        WHEN "kind" = 'ollama' THEN 'ollama'
        WHEN lower("base_url") LIKE '%://api.openai.com%' THEN 'openai'
        WHEN lower("base_url") LIKE '%://api.anthropic.com%' THEN 'anthropic'
        WHEN lower("base_url") LIKE '%://generativelanguage.googleapis.com%' THEN 'gemini'
        WHEN lower("base_url") LIKE '%://openrouter.ai%' THEN 'openrouter'
        WHEN lower("base_url") LIKE '%://api.deepseek.com%' THEN 'deepseek'
        WHEN lower("base_url") LIKE '%://api.groq.com%' THEN 'groq'
        ELSE 'openai_compatible'
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_providers" DROP COLUMN "driver"`);
  }
}
