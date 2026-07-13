"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, Send } from "lucide-react";
import type { QuizAttempt, QuizAttemptResult } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { PRIMARY_ACTION_CLASS } from "@/components/classroom/classroom-ui";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import { getQuizAttempt, saveQuizAnswer, submitQuizAttempt } from "./quiz-api";
import { QuizResultView } from "./quiz-result-view";
export function QuizAttemptRunner({ attemptId }: { attemptId: string }) {
  const { accessToken } = useAuth();
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const locks = useRef(new Set<string>());
  const load = useCallback(
    () =>
      getQuizAttempt(attemptId, accessToken ?? undefined)
        .then((data) => {
          if (data.status !== "in_progress")
            return submitQuizAttempt(attemptId, accessToken ?? undefined).then(
              setResult,
            );
          setAttempt(data);
        })
        .catch((cause) => setError(getErrorMessage(cause))),
    [accessToken, attemptId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      attempt?.deadlineAt &&
      now >= new Date(attempt.deadlineAt).getTime() &&
      !result
    )
      void submitQuizAttempt(attemptId, accessToken ?? undefined)
        .then(setResult)
        .catch((cause) => setError(getErrorMessage(cause)));
  }, [accessToken, attempt, attemptId, now, result]);
  async function select(
    questionId: string,
    optionId: string,
    multiple: boolean,
  ) {
    if (!attempt || locks.current.has(questionId)) return;
    const current = attempt.answers[questionId] ?? [];
    const selected = multiple
      ? current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
      : [optionId];
    setAttempt({
      ...attempt,
      answers: { ...attempt.answers, [questionId]: selected },
    });
    locks.current.add(questionId);
    try {
      await saveQuizAnswer(
        attempt.id,
        questionId,
        { selectedOptionIds: selected },
        accessToken ?? undefined,
      );
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      locks.current.delete(questionId);
    }
  }
  if (result) return <QuizResultView result={result} />;
  const remaining = attempt?.deadlineAt
    ? Math.max(
        0,
        Math.ceil((new Date(attempt.deadlineAt).getTime() - now) / 1000),
      )
    : null;
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">
        {attempt ? (
          <>
            <header className="sticky top-3 z-10 flex items-center justify-between gap-4 rounded-2xl border-2 border-foreground bg-surface p-4 shadow-brutal-md">
              <div>
                <p className="text-sm font-bold text-muted-foreground">
                  Lượt {attempt.attemptNumber}
                </p>
                <h1 className="font-display text-xl font-extrabold">
                  {attempt.quizTitle}
                </h1>
              </div>
              {remaining !== null ? (
                <span className="flex items-center gap-2 rounded-xl border-2 border-foreground bg-warning-soft px-3 py-2 font-extrabold tabular-nums">
                  <Clock3 className="h-4 w-4" />
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                </span>
              ) : null}
            </header>
            <div className="mt-6 space-y-5">
              {attempt.questions.map((question, index) => (
                <fieldset
                  key={question.id}
                  className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-sm"
                >
                  <legend className="px-2 font-display text-xl font-extrabold">
                    Câu {index + 1}
                  </legend>
                  <p className="font-bold">{question.content}</p>
                  <div className="mt-4 space-y-2">
                    {question.options.map((option) => {
                      const checked = (
                        attempt.answers[question.id] ?? []
                      ).includes(option.id);
                      return (
                        <label
                          key={option.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 font-semibold transition-colors ${checked ? "border-foreground bg-primary" : "border-divider hover:bg-surface-soft"}`}
                        >
                          <input
                            type={
                              question.type === "multiple_choice"
                                ? "checkbox"
                                : "radio"
                            }
                            name={question.id}
                            checked={checked}
                            onChange={() =>
                              void select(
                                question.id,
                                option.id,
                                question.type === "multiple_choice",
                              )
                            }
                          />
                          {option.content}
                          {checked ? (
                            <CheckCircle2 className="ml-auto h-5 w-5" />
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            <button
              onClick={() =>
                void submitQuizAttempt(attempt.id, accessToken ?? undefined)
                  .then(setResult)
                  .catch((cause) => setError(getErrorMessage(cause)))
              }
              className={`${PRIMARY_ACTION_CLASS} mt-7 w-full`}
            >
              <Send className="h-5 w-5" />
              Nộp bài
            </button>
          </>
        ) : (
          <p className="font-bold">Đang tải lượt làm...</p>
        )}
        {error ? (
          <p
            className="mt-5 rounded-xl bg-destructive-soft p-3 font-bold"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
