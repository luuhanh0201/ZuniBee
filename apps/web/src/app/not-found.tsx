import { Compass } from "lucide-react";
import { RouteStatusPage } from "@/components/route-status-page";

export default function NotFound() {
  return (
    <RouteStatusPage
      code="404"
      icon={Compass}
      accent="secondary"
      sticker="Đường dẫn gián đoạn"
      eyebrow="Trang không tồn tại"
      title="Trang bạn tìm không còn ở đường dẫn này"
      description="Đường dẫn có thể đã thay đổi hoặc nội dung đã được di chuyển. Hãy quay về không gian chính để tiếp tục."
      primaryAction={{ href: "/", label: "Về trang chủ" }}
    />
  );
}
