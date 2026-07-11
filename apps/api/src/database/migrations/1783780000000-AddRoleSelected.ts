import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleSelected1783780000000 implements MigrationInterface {
  name = 'AddRoleSelected1783780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role_selected" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role_selected"`);
  }
}
