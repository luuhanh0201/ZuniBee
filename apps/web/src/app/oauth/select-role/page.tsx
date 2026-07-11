import type { Metadata } from "next";
import { OAuthRoleSelection } from "@/components/auth/oauth-role-selection";

export const metadata: Metadata = {
  title: "Chọn vai trò — ZuniBee",
  description: "Chọn trải nghiệm học sinh hoặc giáo viên trên ZuniBee.",
};

export default function OAuthSelectRolePage() {
  return <OAuthRoleSelection />;
}
