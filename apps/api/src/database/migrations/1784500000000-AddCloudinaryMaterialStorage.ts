import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCloudinaryMaterialStorage1784500000000 implements MigrationInterface {
  name = 'AddCloudinaryMaterialStorage1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1 FROM "classroom_materials"
           WHERE "storage_provider" = 'gcs'
         ) THEN
           RAISE EXCEPTION 'Cannot remove legacy gcs storage provider while classroom materials still use it';
         END IF;
       END $$`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" DROP CONSTRAINT "CHK_classroom_materials_storage_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" ADD CONSTRAINT "CHK_classroom_materials_storage_provider" CHECK ("storage_provider" IN ('local', 'cloudinary'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" DROP CONSTRAINT "CHK_classroom_materials_storage_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" ADD CONSTRAINT "CHK_classroom_materials_storage_provider" CHECK ("storage_provider" IN ('local', 'gcs'))`,
    );
  }
}
