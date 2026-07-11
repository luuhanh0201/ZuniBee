"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useAuth, ApiError } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast-provider";
import { ROUTES } from "@/config/routes";

export function ForgotPasswordForm() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");

    setIsSubmitting(true);
    try {
      await forgotPassword({ email });
      showToast(
        "success",
        "Đã gửi mật khẩu tạm — vui lòng kiểm tra hộp thư email của bạn.",
      );
      router.push(`${ROUTES.resetPassword}?email=${encodeURIComponent(email)}`);
    } catch (err) {
      showToast(
        "error",
        err instanceof ApiError ? err.message : "Không thể gửi email, vui lòng thử lại",
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
      />

      <SubmitButton
        isSubmitting={isSubmitting}
        label="Gửi mật khẩu tạm"
        loadingLabel="Đang gửi..."
      />
    </form>
  );
}
