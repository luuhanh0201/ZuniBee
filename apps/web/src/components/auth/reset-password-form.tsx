"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useAuth, ApiError } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast-provider";
import { ROUTES } from "@/config/routes";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailFromQuery = searchParams.get("email") ?? "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const tempPassword = String(form.get("tempPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmNewPassword = String(form.get("confirmNewPassword") ?? "");

    if (newPassword !== confirmNewPassword) {
      showToast("error", "Mật khẩu xác nhận không khớp");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await resetPassword({ email, tempPassword, newPassword });
      showToast("success", "Đổi mật khẩu thành công!");
      router.push(
        user.role === "teacher" ? ROUTES.teacherDashboard : ROUTES.studentDashboard,
      );
    } catch (err) {
      showToast(
        "error",
        err instanceof ApiError ? err.message : "Không thể đổi mật khẩu, vui lòng thử lại",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="ban@vidu.com"
        defaultValue={emailFromQuery}
      />
      <TextField
        label="Mật khẩu tạm (nhận qua email)"
        name="tempPassword"
        type="password"
        autoComplete="one-time-code"
        placeholder="Dán mật khẩu tạm vào đây"
      />
      <TextField
        label="Mật khẩu mới"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        placeholder="Tối thiểu 8 ký tự"
      />
      <TextField
        label="Xác nhận mật khẩu mới"
        name="confirmNewPassword"
        type="password"
        autoComplete="new-password"
        placeholder="Nhập lại mật khẩu mới"
      />

      <SubmitButton
        isSubmitting={isSubmitting}
        label="Đổi mật khẩu"
        loadingLabel="Đang đổi mật khẩu..."
      />
    </form>
  );
}
