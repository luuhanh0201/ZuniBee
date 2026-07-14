"use client";
import { CheckCircle2, Clock3, HelpCircle, XCircle } from "lucide-react";
import type { QuizAttemptResult } from "@zunibee/shared";
import { QuizLeaderboard } from "./quiz-leaderboard";
export function QuizResultView({ result }: { result: QuizAttemptResult }) {
  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-3xl border-2 border-foreground bg-primary p-7 text-center shadow-brutal-lg">
          <p className="font-extrabold uppercase">
            {result.isReleased ? "Kết quả" : "Đã nộp bài"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold">
            {result.isReleased
              ? `${result.score} / ${result.maxScore}`
              : "Chờ giáo viên công bố"}
          </h1>
          <p className="mt-2 font-bold">
            Hoàn thành trong {result.timeTakenSeconds} giây
          </p>
        </section>
        {!result.isReleased ? (
          <section className="mt-6 flex gap-3 rounded-2xl border-2 border-foreground bg-warning-soft p-5 shadow-brutal-sm">
            <Clock3 className="h-6 w-6 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl font-extrabold">
                Bài làm đã được ghi nhận
              </h2>
              <p className="mt-1 font-semibold text-muted-foreground">
                Điểm và đáp án sẽ xuất hiện khi đến thời điểm giáo viên đã cấu
                hình.
              </p>
            </div>
          </section>
        ) : null}
        <div className="mt-6 space-y-4">
          {result.answers.map((answer, index) => (
            <article
              key={answer.questionId}
              className={`rounded-2xl border-2 border-foreground p-5 ${answer.isCorrect === null ? "bg-surface" : answer.isCorrect ? "bg-success-soft" : "bg-destructive-soft"}`}
            >
              <div className="flex gap-3">
                {answer.isCorrect === null ? (
                  <HelpCircle />
                ) : answer.isCorrect ? (
                  <CheckCircle2 />
                ) : (
                  <XCircle />
                )}
                <div>
                  <h2 className="font-extrabold">
                    Câu {index + 1}: {answer.content}
                  </h2>
                  <p className="mt-1 font-bold">
                    {answer.isCorrect === null
                      ? "Giáo viên đang ẩn đáp án đúng"
                      : `${answer.scoreAwarded} điểm`}
                  </p>
                  {answer.explanation ? (
                    <p className="mt-3 border-t-2 border-divider pt-3 font-semibold">
                      {answer.explanation}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
        {result.isReleased ? <QuizLeaderboard quizId={result.quizId} /> : null}
      </div>
    </main>
  );
}
