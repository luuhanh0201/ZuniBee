import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { TeacherClassroomsList } from "@/components/classroom/teacher-classrooms-list";

export const metadata: Metadata = {
  title: "Lớp học của tôi — ZuniBee",
  description: "Tạo và quản lý lớp học dành cho giáo viên trên ZuniBee.",
};

export default function TeacherClassroomsPage() {
  return (
    <RequireRole role={UserRole.TEACHER}>
      <TeacherClassroomsList />
    </RequireRole>
  );
}
