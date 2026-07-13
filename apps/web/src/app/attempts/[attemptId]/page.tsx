import { QuizAttemptRunner } from "@/components/quiz/quiz-attempt-runner";
export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <QuizAttemptRunner attemptId={attemptId} />;
}
