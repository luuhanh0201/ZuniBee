import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClassroomMaterialStorageProvider1784400000000 implements MigrationInterface {
  name = 'AddClassroomMaterialStorageProvider1784400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" ADD "storage_provider" character varying(16) NOT NULL DEFAULT 'local'`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" ADD CONSTRAINT "CHK_classroom_materials_storage_provider" CHECK ("storage_provider" IN ('local', 'gcs'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" DROP CONSTRAINT "CHK_classroom_materials_storage_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" DROP COLUMN "storage_provider"`,
    );
  }
}
