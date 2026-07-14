import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureAiCreditAccountForEveryUser1784100000000 implements MigrationInterface {
  name = 'EnsureAiCreditAccountForEveryUser1784100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Trigger giữ invariant cho mọi đường tạo user (email, OAuth, seed/import),
    // không phụ thuộc việc code ứng dụng có nhớ tạo ví credit hay không.
    await queryRunner.query(`
      CREATE FUNCTION "create_ai_credit_account_for_user"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        INSERT INTO "ai_credit_accounts" ("user_id", "balance", "reserved")
        VALUES (NEW."id", 0, 0)
        ON CONFLICT ("user_id") DO NOTHING;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_users_create_ai_credit_account"
      AFTER INSERT ON "users"
      FOR EACH ROW
      EXECUTE FUNCTION "create_ai_credit_account_for_user"()
    `);

    // Tạo account 0 credit cho toàn bộ user đã tồn tại trước migration.
    await queryRunner.query(`
      INSERT INTO "ai_credit_accounts" ("user_id", "balance", "reserved")
      SELECT "id", 0, 0 FROM "users"
      ON CONFLICT ("user_id") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "TRG_users_create_ai_credit_account" ON "users"`,
    );
    await queryRunner.query(
      `DROP FUNCTION "create_ai_credit_account_for_user"()`,
    );
    // Không xóa account đã backfill vì có thể đã phát sinh số dư/lịch sử.
  }
}
