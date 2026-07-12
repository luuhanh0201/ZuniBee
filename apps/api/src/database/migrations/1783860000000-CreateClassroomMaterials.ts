import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClassroomMaterials1783860000000 implements MigrationInterface {
  name = 'CreateClassroomMaterials1783860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."classroom_materials_type_enum" AS ENUM('link', 'file')`,
    );
    await queryRunner.query(
      `CREATE TABLE "classroom_materials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "classroom_id" uuid NOT NULL,
        "title" character varying(160) NOT NULL,
        "description" text,
        "type" "public"."classroom_materials_type_enum" NOT NULL,
        "url" text,
        "storage_name" character varying(255),
        "original_name" character varying(255),
        "mime_type" character varying(160),
        "size" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_classroom_materials_source" CHECK (
          ("type" = 'link' AND "url" IS NOT NULL AND "storage_name" IS NULL)
          OR
          ("type" = 'file' AND "url" IS NULL AND "storage_name" IS NOT NULL)
        ),
        CONSTRAINT "PK_classroom_materials" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_classroom_materials_classroom_id" ON "classroom_materials" ("classroom_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" ADD CONSTRAINT "FK_classroom_materials_classroom" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "classroom_materials" DROP CONSTRAINT "FK_classroom_materials_classroom"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_classroom_materials_classroom_id"`,
    );
    await queryRunner.query(`DROP TABLE "classroom_materials"`);
    await queryRunner.query(
      `DROP TYPE "public"."classroom_materials_type_enum"`,
    );
  }
}
