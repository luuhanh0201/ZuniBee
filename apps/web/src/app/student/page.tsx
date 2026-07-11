import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { DemoDashboard } from "@/components/dashboard/demo-dashboard";
import { RequireRole } from "@/components/auth/require-role";

export const metadata: Metadata = {
  title: "Dashboard học sinh — ZuniBee",
  description: "Trải nghiệm dashboard học sinh bản demo của ZuniBee.",
};

export default function StudentDashboardPage() {
  return (
    <RequireRole role={UserRole.STUDENT}>
      <DemoDashboard role={UserRole.STUDENT} />
    </RequireRole>
  );
}
