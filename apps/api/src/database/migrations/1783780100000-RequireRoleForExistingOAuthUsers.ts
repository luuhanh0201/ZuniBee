import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequireRoleForExistingOAuthUsers1783780100000 implements MigrationInterface {
  name = 'RequireRoleForExistingOAuthUsers1783780100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "role_selected" = false WHERE "provider" IN ('google', 'facebook')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "role_selected" = true WHERE "provider" IN ('google', 'facebook')`,
    );
  }
}
