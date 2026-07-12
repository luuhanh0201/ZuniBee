import type { Metadata } from "next";
import { OAuthRoleSelection } from "@/components/auth/oauth-role-selection";
import { getSafeReturnTo } from "@/components/classroom/safe-return-to";

export const metadata: Metadata = {
  title: "Chọn vai trò — ZuniBee",
  description: "Chọn trải nghiệm học sinh hoặc giáo viên trên ZuniBee.",
};

export default async function OAuthSelectRolePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const query = await searchParams;
  return <OAuthRoleSelection returnTo={getSafeReturnTo(query.returnTo)} />;
}
