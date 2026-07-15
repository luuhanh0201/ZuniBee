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

## Chạy migration trên Docker

Đây là cách khuyến nghị cho môi trường chạy bằng `docker-compose.yml`. Thực hiện
các lệnh từ thư mục gốc monorepo, nơi chứa file `.env` và
`docker-compose.yml`.

### 1. Đảm bảo PostgreSQL đang chạy

```bash
docker compose up -d postgres
```

### 2. Build lại image migration

```bash
docker compose --profile tools build migrate
```

Luôn build lại bước này sau khi pull code hoặc thêm migration mới. Service
`migrate` có image riêng; nếu dùng image cũ, TypeORM có thể báo
`No migrations are pending` dù source code đã có migration mới.

### 3. Chạy các migration còn thiếu

```bash
docker compose --profile tools run --rm migrate
```

TypeORM chỉ chạy migration chưa được ghi nhận trong bảng
`typeorm_migrations`. Chạy lại lệnh này khi không còn migration mới sẽ không
thay đổi schema.

### 4. Kiểm tra trạng thái

```bash
docker compose --profile tools run --rm migrate \
  node_modules/.bin/typeorm migration:show \
  -d dist/database/data-source.js
```

- `[X]`: migration đã chạy.
- `[ ]`: migration chưa chạy.

### Quy trình ngắn gọn thường dùng

```bash
docker compose --profile tools build migrate
docker compose --profile tools run --rm migrate
```

Không dùng `npm run migration:run` hoặc `pnpm migration:run` trên host để cập
nhật database Docker nếu chưa kiểm tra kỹ các biến `DATABASE_*`. Các lệnh trên
host có thể kết nối tới PostgreSQL local, trong khi API container sử dụng host
`postgres` trong Docker network.
