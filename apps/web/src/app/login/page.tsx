import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: "Đăng nhập — ZuniBee",
  description: "Đăng nhập vào ZuniBee để tiếp tục học tập và quiz.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Chào mừng trở lại!"
      subtitle="Đăng nhập để tiếp tục hành trình học tập"
      footer={{
        text: "Chưa có tài khoản?",
        linkLabel: "Đăng ký ngay",
        href: ROUTES.register,
      }}
    >
      <LoginForm />
    </AuthShell>
  );
}
