import { PublicQuizLanding } from "@/components/quiz/public-quiz-landing";
export default async function PublicQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  return <PublicQuizLanding quizId={quizId} />;
}
