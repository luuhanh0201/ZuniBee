"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@zunibee/shared";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Divider } from "@/components/ui/divider";
import { SocialButtons } from "@/components/auth/social-buttons";
import { useAuth, ApiError } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast-provider";
import { ROUTES } from "@/config/routes";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setIsSubmitting(true);
    try {
      const user = await login({ email, password });
      showToast("success", "Đăng nhập thành công!");
      router.push(
        user.role === UserRole.TEACHER
          ? ROUTES.teacherDashboard
          : ROUTES.studentDashboard,
      );
    } catch (err) {
      showToast(
        "error",
        err instanceof ApiError
          ? err.message
          : "Không thể đăng nhập, vui lòng thử lại",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
        />
        <TextField
          label="Mật khẩu"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground/80">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer rounded border-2 border-foreground accent-primary"
            />
            Ghi nhớ đăng nhập
          </label>
          <Link
            href={ROUTES.forgotPassword}
            className="cursor-pointer font-semibold text-foreground underline decoration-2 underline-offset-2 hover:text-primary"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <SubmitButton
          isSubmitting={isSubmitting}
          label="Đăng nhập"
          loadingLabel="Đang đăng nhập..."
        />
      </form>

      <Divider label="Hoặc" />

      <SocialButtons />
    </div>
  );
}
