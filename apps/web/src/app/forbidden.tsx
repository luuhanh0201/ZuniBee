import { ShieldAlert } from "lucide-react";
import { RouteStatusPage } from "@/components/route-status-page";

export default function Forbidden() {
  return (
    <RouteStatusPage
      code="403"
      icon={ShieldAlert}
      accent="destructive"
      sticker="Khu vực được giới hạn"
      eyebrow="Không đủ quyền truy cập"
      title="Bạn chưa có quyền mở nội dung này"
      description="Tài khoản của bạn không đủ quyền để xem trang này. Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ quản trị viên."
      primaryAction={{ href: "/", label: "Về trang chủ" }}
    />
  );
}
