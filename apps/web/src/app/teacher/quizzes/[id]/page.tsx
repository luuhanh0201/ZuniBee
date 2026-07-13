import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { QuizEditor } from "@/components/quiz/quiz-editor";
export default async function QuizEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireRole role={UserRole.TEACHER}>
      <QuizEditor quizId={id} />
    </RequireRole>
  );
}
