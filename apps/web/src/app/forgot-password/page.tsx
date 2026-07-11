import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: "Quên mật khẩu — ZuniBee",
  description: "Nhận mật khẩu tạm qua email để lấy lại quyền truy cập tài khoản.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Quên mật khẩu?"
      subtitle="Nhập email đã đăng ký, chúng tôi sẽ gửi mật khẩu tạm cho bạn"
      footer={{
        text: "Đã nhớ mật khẩu?",
        linkLabel: "Đăng nhập",
        href: ROUTES.login,
      }}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
