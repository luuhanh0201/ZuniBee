"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useAuth, ApiError } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast-provider";

export function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmNewPassword = String(form.get("confirmNewPassword") ?? "");

    if (newPassword !== confirmNewPassword) {
      showToast("error", "Mật khẩu xác nhận không khớp");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      showToast("success", "Đổi mật khẩu thành công!");
      event.currentTarget.reset();
    } catch (err) {
      showToast(
        "error",
        err instanceof ApiError ? err.message : "Không thể đổi mật khẩu, vui lòng thử lại",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="Mật khẩu hiện tại"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        placeholder="Bỏ trống nếu chưa từng đặt mật khẩu"
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
