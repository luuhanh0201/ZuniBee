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
import { BrandLockup } from "@/components/ui/brand-lockup";
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
      if (guestToken)
        localStorage.setItem(`zunibee-guest-attempt-${attempt.id}`, guestToken);
      router.push(quizAttemptRoute(attempt.id));
    } catch (cause) {
      setError(getErrorMessage(cause));
      lock.current = false;
    }
  }
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:py-12">
      <div className="mx-auto mb-8 max-w-2xl">
        <BrandLockup />
      </div>
      <div className="study-surface mx-auto max-w-2xl overflow-hidden">
        <div className="border-b border-divider bg-surface-soft p-7 sm:p-10">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
            <BookOpenCheck className="h-7 w-7" aria-hidden="true" />
          </span>
          {quiz ? (
            <>
              <p className="editorial-label mt-6">
                Hoạt động học · {quiz.questionCount} câu · {quiz.totalScore}{" "}
                điểm
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold">
                {quiz.title}
              </h1>
              <p className="mt-3 font-semibold text-muted-foreground">
                {quiz.description || "Đọc kỹ hướng dẫn trước khi bắt đầu."}
              </p>
            </>
          ) : (
            <p className="mt-6 font-bold">Đang tải hoạt động...</p>
          )}
        </div>
        <div className="p-7 sm:p-10">
          {quiz ? (
            <form onSubmit={start} className="space-y-4">
              {!user ? (
                <label className="block font-bold">
                  Tên hiển thị
                  <input
                    className={`${INPUT_CLASS} mt-2`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    autoComplete="name"
                  />
                </label>
              ) : (
                <p className="rounded-xl border border-success/30 bg-success-soft p-3 font-bold">
                  Bài làm sẽ được ghi nhận bằng tài khoản hiện tại.
                </p>
              )}
              <button className={`${PRIMARY_ACTION_CLASS} w-full`}>
                <Play className="h-5 w-5" aria-hidden="true" />
                Bắt đầu hoạt động
              </button>
            </form>
          ) : null}
          {error ? (
            <p
              className="mt-5 rounded-xl border border-destructive/30 bg-destructive-soft p-3 font-bold"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
