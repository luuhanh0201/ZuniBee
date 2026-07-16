import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import {
  getSafeReturnTo,
  withReturnTo,
} from "@/components/classroom/safe-return-to";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: "Đăng ký — ZuniBee",
  description:
    "Tạo tài khoản ZuniBee để bắt đầu một hành trình học có cấu trúc cùng AI.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const query = await searchParams;
  const returnTo = getSafeReturnTo(query.returnTo);

  return (
    <AuthShell
      title="Tạo tài khoản ZuniBee"
      subtitle="Chọn vai trò và chuẩn bị không gian học tập phù hợp với bạn."
      footer={{
        text: "Đã có tài khoản?",
        linkLabel: "Đăng nhập",
        href: withReturnTo(ROUTES.login, returnTo),
      }}
    >
      <RegisterForm returnTo={returnTo} />
    </AuthShell>
  );
}
