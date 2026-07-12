import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClassrooms1783850000000 implements MigrationInterface {
  name = 'CreateClassrooms1783850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."classrooms_status_enum" AS ENUM('active', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."classroom_invitations_status_enum" AS ENUM('pending', 'accepted', 'revoked', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "classrooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "subject" character varying(120),
        "grade" character varying(50),
        "status" "public"."classrooms_status_enum" NOT NULL DEFAULT 'active',
        "join_code" character varying(9) NOT NULL,
        "join_token" character varying(64) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classrooms" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_classrooms_join_code" ON "classrooms" ("join_code")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_classrooms_join_token" ON "classrooms" ("join_token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_classrooms_teacher_id" ON "classrooms" ("teacher_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "classroom_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "classroom_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classroom_members" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_classroom_members_classroom_user" ON "classroom_members" ("classroom_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_classroom_members_classroom_id" ON "classroom_members" ("classroom_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_classroom_members_user_id" ON "classroom_members" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "classroom_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "classroom_id" uuid NOT NULL,
        "email" character varying(320) NOT NULL,
        "token_hash" character(64) NOT NULL,
        "status" "public"."classroom_invitations_status_enum" NOT NULL DEFAULT 'pending',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_classroom_invitations_email_normalized" CHECK ("email" = lower(btrim("email"))),
        CONSTRAINT "PK_classroom_invitations" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_classroom_invitations_token_hash" ON "classroom_invitations" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_classroom_invitations_classroom_id" ON "classroom_invitations" ("classroom_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_classroom_invitations_pending_email" ON "classroom_invitations" ("classroom_id", "email") WHERE "status" = 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "classrooms" ADD CONSTRAINT "FK_classrooms_teacher" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_members" ADD CONSTRAINT "FK_classroom_members_classroom" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_members" ADD CONSTRAINT "FK_classroom_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_invitations" ADD CONSTRAINT "FK_classroom_invitations_classroom" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "classroom_invitations" DROP CONSTRAINT "FK_classroom_invitations_classroom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_members" DROP CONSTRAINT "FK_classroom_members_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classroom_members" DROP CONSTRAINT "FK_classroom_members_classroom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classrooms" DROP CONSTRAINT "FK_classrooms_teacher"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_classroom_invitations_pending_email"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_classroom_invitations_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_classroom_invitations_classroom_id"`,
    );
    await queryRunner.query(`DROP TABLE "classroom_invitations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_classroom_members_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_classroom_members_classroom_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_classroom_members_classroom_user"`,
    );
    await queryRunner.query(`DROP TABLE "classroom_members"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_classrooms_teacher_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_classrooms_join_token"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_classrooms_join_code"`);
    await queryRunner.query(`DROP TABLE "classrooms"`);
    await queryRunner.query(
      `DROP TYPE "public"."classroom_invitations_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."classrooms_status_enum"`);
  }
}
