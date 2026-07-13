import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { QuizList } from "@/components/quiz/quiz-list";
export default function TeacherQuizzesPage() {
  return (
    <RequireRole role={UserRole.TEACHER}>
      <QuizList />
    </RequireRole>
  );
}
