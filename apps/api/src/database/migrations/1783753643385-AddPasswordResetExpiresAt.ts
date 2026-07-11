import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetExpiresAt1783753643385 implements MigrationInterface {
  name = 'AddPasswordResetExpiresAt1783753643385';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_expires_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_reset_expires_at"`,
    );
  }
}
