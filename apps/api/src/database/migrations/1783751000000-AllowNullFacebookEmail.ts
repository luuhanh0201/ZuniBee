import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowNullFacebookEmail1783751000000 implements MigrationInterface {
  name = 'AllowNullFacebookEmail1783751000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL',
    );
  }
}
