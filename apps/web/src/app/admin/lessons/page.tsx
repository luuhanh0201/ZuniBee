import type { Metadata } from "next";
import { LessonBuilderMock } from "@/components/lesson/lesson-builder-mock";

export const metadata: Metadata = {
  title: "Bài học AI — ZuniBee Admin",
  description:
    "Prototype quản trị luồng tạo bài học theo chủ đề từ tài liệu.",
};

export default function AdminLessonsPage() {
  return <LessonBuilderMock variant="admin" />;
}
