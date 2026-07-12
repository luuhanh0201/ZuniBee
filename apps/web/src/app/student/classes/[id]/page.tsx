import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { StudentClassroomDetail } from "@/components/classroom/student-classroom-detail";

export const metadata: Metadata = {
  title: "Chi tiết lớp học — ZuniBee",
  description: "Xem giáo viên, tài liệu và quiz trong lớp học.",
};

export default async function StudentClassroomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequireRole role={UserRole.STUDENT}>
      <StudentClassroomDetail classroomId={id} />
    </RequireRole>
  );
}
