# pgAdmin cho PostgreSQL Docker

pgAdmin chạy trong Docker và chỉ được publish tại `127.0.0.1:5050`. PostgreSQL
không mở cổng `5432` ra host hoặc Internet.

## Khởi động

Chạy từ thư mục gốc monorepo:

```bash
docker compose up -d pgadmin
docker compose ps pgadmin
docker compose logs --tail=100 pgadmin
```

Thông tin đăng nhập pgAdmin nằm trong file `.env` ở root:

```text
PGADMIN_DEFAULT_EMAIL
PGADMIN_DEFAULT_PASSWORD
```

## Mở qua Cloudflare Tunnel

Public hostname đã được thêm vào tunnel đang dùng:

```text
Hostname: mypostgresql.zunibee.online
Service:  http://localhost:5050
```

Sau khi hostname hoạt động, mở:

```text
https://mypostgresql.zunibee.online
```

Tunnel được quản lý bằng `systemd --user` và đọc cấu hình tại
`~/.cloudflared/config.yml`:

```bash
systemctl --user status cloudflared
systemctl --user restart cloudflared
cloudflared tunnel ingress validate
```

## Đăng ký PostgreSQL trong pgAdmin

Trong pgAdmin, chọn **Register > Server** và nhập:

```text
Name:                 ZuniBee PostgreSQL
Host name/address:    postgres
Port:                 5432
Maintenance database: giá trị DATABASE_NAME trong .env
Username:             giá trị DATABASE_USER trong .env
Password:             giá trị DATABASE_PASSWORD trong .env
```

Bật **Save password** nếu muốn pgAdmin lưu mật khẩu trong volume
`pgadmin-data`.

## Dừng hoặc tạo lại container

```bash
docker compose stop pgadmin
docker compose up -d --force-recreate pgadmin
```

Không xóa volume `pgadmin-data` nếu muốn giữ danh sách server và cấu hình
pgAdmin đã lưu.
