import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { CreateClassroomWizard } from "@/components/classroom/create-classroom-wizard";

export const metadata: Metadata = {
  title: "Tạo lớp học — ZuniBee",
  description: "Tạo lớp học mới và mời sinh viên tham gia trên ZuniBee.",
};

export default function NewTeacherClassroomPage() {
  return (
    <RequireRole role={UserRole.TEACHER}>
      <CreateClassroomWizard />
    </RequireRole>
  );
}
