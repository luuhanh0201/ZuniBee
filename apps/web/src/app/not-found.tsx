import { Compass } from "lucide-react";
import { RouteStatusPage } from "@/components/route-status-page";

export default function NotFound() {
  return (
    <RouteStatusPage
      code="404"
      icon={Compass}
      accent="secondary"
      sticker="Lạc đường rồi!"
      eyebrow="Trang không tồn tại"
      title="Chỗ này chưa có bài học nào cả"
      description="Có thể đường dẫn đã thay đổi hoặc trang bạn tìm kiếm không còn tồn tại. Mình quay về điểm xuất phát nhé!"
      primaryAction={{ href: "/", label: "Về trang chủ" }}
    />
  );
}
