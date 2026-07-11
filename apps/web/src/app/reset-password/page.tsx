import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu — ZuniBee",
  description: "Nhập mật khẩu tạm nhận được qua email và đặt mật khẩu mới.",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Đặt lại mật khẩu"
      subtitle="Nhập mật khẩu tạm từ email và chọn mật khẩu mới"
      footer={{
        text: "Chưa nhận được email?",
        linkLabel: "Gửi lại",
        href: ROUTES.forgotPassword,
      }}
    >
      <Suspense
        fallback={
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
