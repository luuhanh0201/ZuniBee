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
  description: "Tạo tài khoản ZuniBee để bắt đầu học tập và quiz cùng AI.",
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
      subtitle="Bắt đầu hành trình học tập vui vẻ cùng AI"
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
