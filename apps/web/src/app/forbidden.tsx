import { ShieldAlert } from "lucide-react";
import { RouteStatusPage } from "@/components/route-status-page";

export default function Forbidden() {
  return (
    <RouteStatusPage
      code="403"
      icon={ShieldAlert}
      accent="destructive"
      sticker="Dừng lại nè!"
      eyebrow="Không đủ quyền truy cập"
      title="Khu vực này bạn chưa được vào"
      description="Tài khoản của bạn không đủ quyền để xem trang này. Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ quản trị viên."
      primaryAction={{ href: "/", label: "Về trang chủ" }}
    />
  );
}
