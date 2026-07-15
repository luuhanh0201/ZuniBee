import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDeletedAt1784300000000 implements MigrationInterface {
  name = 'AddUserDeletedAt1784300000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    // Soft delete: NULL = đang hoạt động. Cột thường (không dùng cơ chế
    // @DeleteDateColumn của TypeORM) để relation join lớp/quiz vẫn thấy
    // giáo viên đã xóa — học sinh không mất dữ liệu học tập.
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
  }
}
