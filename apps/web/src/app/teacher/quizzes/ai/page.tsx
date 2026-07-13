import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { AiQuizGenerator } from "@/components/ai/ai-quiz-generator";
export default function TeacherAiQuizPage() {
  return (
    <RequireRole role={UserRole.TEACHER}>
      <AiQuizGenerator />
    </RequireRole>
  );
}
