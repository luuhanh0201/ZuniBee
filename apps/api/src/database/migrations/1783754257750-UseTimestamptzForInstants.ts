import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseTimestamptzForInstants1783754257750 implements MigrationInterface {
  name = 'UseTimestamptzForInstants1783754257750';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Session cũ vô nghĩa sau khi đổi kiểu cột expires_at (NOT NULL, không có giá trị mặc định
    // hợp lệ để backfill) — xoá đi, client sẽ tự có session mới ở lần đăng nhập/refresh kế tiếp.
    await queryRunner.query(`DELETE FROM "user_sessions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_login_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_reset_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "last_activity_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "revoked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "revoked_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "revoked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "revoked_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "expires_at" TIMESTAMP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "last_activity_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "last_activity_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_reset_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_expires_at" TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_login_at" TIMESTAMP`,
    );
  }
}
