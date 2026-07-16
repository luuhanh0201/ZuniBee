import { LogIn } from "lucide-react";
import { RouteStatusPage } from "@/components/route-status-page";
import { ROUTES } from "@/config/routes";

export default function Unauthorized() {
  return (
    <RouteStatusPage
      code="401"
      icon={LogIn}
      accent="success"
      sticker="Xác thực tài khoản"
      eyebrow="Cần đăng nhập"
      title="Bạn cần đăng nhập để vào đây"
      description="Vui lòng đăng nhập để tiếp tục truy cập trang này."
      primaryAction={{ href: ROUTES.login, label: "Đăng nhập", icon: LogIn }}
      secondaryAction={{ href: ROUTES.home, label: "Về trang chủ" }}
    />
  );
}
