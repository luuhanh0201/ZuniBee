import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { LessonBuilderMock } from "@/components/lesson/lesson-builder-mock";

export const metadata: Metadata = {
  title: "Tạo bài học theo chủ đề — ZuniBee",
  description:
    "Dựng bài học có cấu trúc từ tài liệu với AI và bước xác nhận của giáo viên.",
};

export default function TeacherLessonsPage() {
  return (
    <RequireRole role={UserRole.TEACHER}>
      <LessonBuilderMock variant="teacher" />
    </RequireRole>
  );
}
