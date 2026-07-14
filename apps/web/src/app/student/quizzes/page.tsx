import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { StudentQuizWorkspace } from "@/components/quiz/student-quiz-workspace";

export const metadata: Metadata = {
  title: "Quiz của tôi — ZuniBee",
  description: "Theo dõi quiz được giao, tiếp tục làm bài và xem lịch sử.",
};

export default function StudentQuizzesPage() {
  return (
    <RequireRole role={UserRole.STUDENT}>
      <StudentQuizWorkspace />
    </RequireRole>
  );
}
