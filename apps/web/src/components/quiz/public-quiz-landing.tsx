"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Play } from "lucide-react";
import type { QuizDetail } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { quizAttemptRoute } from "@/config/routes";
import {
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import { getQuiz, startQuizAttempt } from "./quiz-api";
export function PublicQuizLanding({ quizId }: { quizId: string }) {
  const { accessToken, user } = useAuth();
  const router = useRouter();
  const lock = useRef(false);
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    getQuiz(quizId, accessToken ?? undefined)
      .then(setQuiz)
      .catch((cause) => setError(getErrorMessage(cause)));
  }, [accessToken, quizId]);
  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || (!user && !name.trim())) return;
    lock.current = true;
    setError("");
    try {
      let guestToken: string | undefined;
      if (!user) {
        const key = `zunibee-guest-${quizId}`;
        guestToken =
          localStorage.getItem(key) ?? crypto.randomUUID().replaceAll("-", "");
        localStorage.setItem(key, guestToken);
      }
      const attempt = await startQuizAttempt(
        { quizId, guestToken, guestName: user ? undefined : name },
        accessToken ?? undefined,
      );
      router.push(quizAttemptRoute(attempt.id));
    } catch (cause) {
      setError(getErrorMessage(cause));
      lock.current = false;
    }
  }
  return (
    <main className="min-h-dvh bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl rounded-3xl border-2 border-foreground bg-surface p-7 shadow-brutal-lg sm:p-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-primary shadow-brutal-md">
          <BookOpenCheck className="h-8 w-8" />
        </span>
        {quiz ? (
          <>
            <p className="mt-6 font-extrabold uppercase text-muted-foreground">
              Quiz · {quiz.questionCount} câu · {quiz.totalScore} điểm
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold">
              {quiz.title}
            </h1>
            <p className="mt-3 font-semibold text-muted-foreground">
              {quiz.description || "Sẵn sàng bắt đầu bài quiz."}
            </p>
            <form onSubmit={start} className="mt-7 space-y-4">
              {!user ? (
                <label className="block font-extrabold">
                  Tên hiển thị
                  <input
                    className={`${INPUT_CLASS} mt-2`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                  />
                </label>
              ) : (
                <p className="rounded-xl bg-success-soft p-3 font-bold">
                  Bạn sẽ làm bài bằng tài khoản hiện tại.
                </p>
              )}
              <button className={`${PRIMARY_ACTION_CLASS} w-full`}>
                <Play className="h-5 w-5" />
                Bắt đầu làm bài
              </button>
            </form>
          </>
        ) : (
          <p className="mt-6 font-bold">Đang tải quiz...</p>
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
