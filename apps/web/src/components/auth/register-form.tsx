"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@zunibee/shared";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Divider } from "@/components/ui/divider";
import { SocialButtons } from "@/components/auth/social-buttons";
import { RolePicker } from "@/components/auth/role-picker";
import { useAuth, ApiError } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast-provider";
import { ROUTES } from "@/config/routes";

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const role = String(form.get("role") ?? "");
    const agreedTerms = form.get("agreedTerms") === "on";

    if (role !== UserRole.STUDENT && role !== UserRole.TEACHER) {
      showToast("error", "Vui lòng chọn bạn là Giáo viên hay Học sinh");
      return;
    }
    if (password !== confirmPassword) {
      showToast("error", "Mật khẩu xác nhận không khớp");
      return;
    }
    if (!agreedTerms) {
      showToast("error", "Vui lòng đồng ý với Điều khoản dịch vụ");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await register({ email, password, fullName, role });
      showToast("success", "Tạo tài khoản thành công!");
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
          : "Không thể tạo tài khoản, vui lòng thử lại",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="Họ và tên"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Nguyễn Văn A"
        />
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
          autoComplete="new-password"
          placeholder="Tối thiểu 8 ký tự"
        />
        <TextField
          label="Xác nhận mật khẩu"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
        />

        <RolePicker />

        <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-foreground/80">
          <input
            type="checkbox"
            name="agreedTerms"
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-2 border-foreground accent-primary"
          />
          Tôi đồng ý với{" "}
          <a
            href="#"
            className="cursor-pointer font-semibold text-foreground underline decoration-2 underline-offset-2 hover:text-primary"
          >
            Điều khoản dịch vụ
          </a>{" "}
          của ZuniBee
        </label>

        <SubmitButton
          isSubmitting={isSubmitting}
          label="Tạo tài khoản"
          loadingLabel="Đang tạo tài khoản..."
        />
      </form>

      <Divider label="Hoặc" />

      <SocialButtons />
    </div>
  );
}
