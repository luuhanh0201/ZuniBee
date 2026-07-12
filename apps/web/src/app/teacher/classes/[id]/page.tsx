import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { TeacherClassroomDetail } from "@/components/classroom/teacher-classroom-detail";

export const metadata: Metadata = {
  title: "Quản lý lớp học — ZuniBee",
  description: "Quản lý thành viên, lời mời và quyền truy cập lớp học.",
};

export default async function TeacherClassroomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequireRole role={UserRole.TEACHER}>
      <TeacherClassroomDetail classroomId={id} />
    </RequireRole>
  );
}
