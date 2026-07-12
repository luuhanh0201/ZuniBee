import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { DemoDashboard } from "@/components/dashboard/demo-dashboard";
import { RequireRole } from "@/components/auth/require-role";

export const metadata: Metadata = {
  title: "Dashboard giáo viên — ZuniBee",
  description: "Quản lý lớp học, học sinh và hoạt động dạy học trên ZuniBee.",
};

export default function TeacherDashboardPage() {
  return (
    <RequireRole role={UserRole.TEACHER}>
      <DemoDashboard role={UserRole.TEACHER} />
    </RequireRole>
  );
}
