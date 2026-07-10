# Database migrations

Thư mục chứa migration của TypeORM. Không chỉnh sửa migration đã chạy trên môi
trường dùng chung; hãy tạo migration mới để thay đổi schema.

Chạy các lệnh từ thư mục gốc monorepo:

```bash
# Tạo migration từ thay đổi entity
pnpm migration:generate -- src/database/migrations/InitialSchema

# Tạo migration rỗng để viết SQL thủ công
pnpm migration:create -- src/database/migrations/InitialSchema

# Xem, chạy hoặc hoàn tác migration gần nhất
pnpm migration:show
pnpm migration:run
pnpm migration:revert
```

`migration:generate`, `migration:show`, `migration:run` và `migration:revert`
cần kết nối tới PostgreSQL theo các biến `DATABASE_*`.
