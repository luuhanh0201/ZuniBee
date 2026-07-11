import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = {
  title: "Hồ sơ cá nhân — ZuniBee",
  description: "Quản lý thông tin tài khoản ZuniBee của bạn.",
};

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileForm />
    </RequireAuth>
  );
}
