import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { StudentLessonWorkspace } from "@/components/lesson/student-lesson-workspace";

export const metadata: Metadata = {
  title: "Bài học của tôi — ZuniBee",
  description:
    "Học theo chủ đề, hoàn thành hoạt động và phản hồi nội dung bài học.",
};

export default function StudentLessonsPage() {
  return (
    <RequireRole role={UserRole.STUDENT}>
      <StudentLessonWorkspace />
    </RequireRole>
  );
}
