import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: "Đăng ký — ZuniBee",
  description: "Tạo tài khoản ZuniBee để bắt đầu học tập và quiz cùng AI.",
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Tạo tài khoản ZuniBee"
      subtitle="Bắt đầu hành trình học tập vui vẻ cùng AI"
      footer={{
        text: "Đã có tài khoản?",
        linkLabel: "Đăng nhập",
        href: ROUTES.login,
      }}
    >
      <RegisterForm />
    </AuthShell>
  );
}
