import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { CreateQuizForm } from "@/components/quiz/create-quiz-form";
export default function NewQuizPage() {
  return (
    <RequireRole role={UserRole.TEACHER}>
      <CreateQuizForm />
    </RequireRole>
  );
}
