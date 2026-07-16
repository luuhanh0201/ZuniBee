import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import {
  getSafeReturnTo,
  withReturnTo,
} from "@/components/classroom/safe-return-to";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: "Đăng nhập — ZuniBee",
  description: "Đăng nhập ZuniBee để tiếp tục hành trình học tập của bạn.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const query = await searchParams;
  const returnTo = getSafeReturnTo(query.returnTo);

  return (
    <AuthShell
      title="Chào mừng trở lại!"
      subtitle="Tiếp tục từ lớp học, tài liệu hoặc hoạt động gần nhất của bạn."
      footer={{
        text: "Chưa có tài khoản?",
        linkLabel: "Đăng ký ngay",
        href: withReturnTo(ROUTES.register, returnTo),
      }}
    >
      <LoginForm returnTo={returnTo} />
    </AuthShell>
  );
}
