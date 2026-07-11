import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { RequireAuth } from "@/components/auth/require-auth";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: "Đổi mật khẩu — ZuniBee",
  description: "Đổi mật khẩu tài khoản ZuniBee của bạn.",
};

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <AuthShell
        title="Đổi mật khẩu"
        subtitle="Cập nhật mật khẩu để bảo vệ tài khoản của bạn"
        footer={{
          text: "Xong rồi?",
          linkLabel: "Về trang chủ",
          href: ROUTES.home,
        }}
      >
        <ChangePasswordForm />
      </AuthShell>
    </RequireAuth>
  );
}
