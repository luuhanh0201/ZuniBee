# Admin UI contract

File này là design override được commit cùng code cho toàn bộ route `/admin`.
Nguồn chi tiết ban đầu: `docs/design-admin.md`.

## Phạm vi

- Chỉ áp dụng trong `app/admin` và component chỉ được render bởi `AdminShell`.
- Không thay token hoặc phong cách của route public, giáo viên và học sinh.
- Mọi admin page mới phải dùng theme scoped tại `admin-theme.module.css`.

## Visual language

- Enterprise dashboard: nghiêm túc, sạch, tin cậy, data-first.
- Font Inter cho heading và body.
- Canvas light gray/warm off-white, surface trắng, primary emerald.
- Text dark slate; secondary text blue-gray; border 1px rất nhẹ.
- Radius 12px cho control, 16px cho card/dialog.
- Chỉ dùng soft shadow tinh tế. Không dùng Neo-Brutalism, hard-offset shadow,
  border navy dày hoặc mảng trang trí xoay.
- Icon chức năng dùng Lucide, không dùng emoji.

## Interaction contract

- Click target tối thiểu 44px, có `cursor-pointer` và focus ring rõ.
- Hover chỉ đổi màu/border/shadow nhẹ, không làm layout dịch chuyển.
- Async action phải khóa click lặp và có loading/success/error feedback.
- Destructive action phải có confirmation dialog.
- Không dùng màu làm tín hiệu duy nhất; luôn kèm label hoặc icon.
- Tôn trọng `prefers-reduced-motion`.

## Data UI

- Không hard-code số liệu vận hành hoặc mock data trong page production.
- Danh sách phải có loading, empty và error state; khi phù hợp có search,
  filter, sort, pagination, row selection và bulk action.
- Bảng rộng dùng container `overflow-x-auto`, không gây scroll ngang viewport.
- Chỉ render chart khi có API thật; chart phải có tooltip và mô tả text.

## Layout contract

- Sidebar desktop cố định, thu gọn được; mobile/tablet dùng drawer.
- Header gồm breadcrumb, tìm kiếm điều hướng, cảnh báo và tài khoản admin.
- Content max width 1440px; kiểm tra 375, 768, 1024 và 1440px.
- Mọi trang admin phải nằm trong `AdminShell`, không tự tạo shell/menu riêng.
