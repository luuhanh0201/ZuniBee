import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { StudentClassrooms } from "@/components/classroom/student-classrooms";

export const metadata: Metadata = {
  title: "Lớp học của tôi — ZuniBee",
  description: "Tham gia và xem các lớp học của bạn trên ZuniBee.",
};

export default function StudentClassesPage() {
  return (
    <RequireRole role={UserRole.STUDENT}>
      <StudentClassrooms />
    </RequireRole>
  );
}
