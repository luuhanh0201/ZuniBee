# Codex workspace rules

## Local-only validation

- Không được tự chạy `docker build`, `docker compose build`, `docker compose up --build` hoặc bất kỳ thao tác nào tạo lại image/container.
- Mọi lệnh test, lint, typecheck và build phải chạy trực tiếp trong workspace local bằng các script của repository (ví dụ `pnpm test`, `pnpm build`), không chạy bên trong Docker.
- Không tự dùng Docker để chạy migration, smoke test, restart hoặc recreate service. Nếu việc kiểm tra thật sự cần thay đổi trạng thái Docker, phải dừng lại, báo rõ lý do và chờ người dùng yêu cầu hoặc cho phép cụ thể trong lượt hiện tại.
- Có thể dùng thao tác Docker chỉ đọc như xem trạng thái hoặc log khi cần chẩn đoán, miễn là không thay đổi container, image, volume hay dữ liệu.

