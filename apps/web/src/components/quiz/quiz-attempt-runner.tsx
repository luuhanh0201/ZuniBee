"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CloudOff,
  Loader2,
  Save,
  Send,
  X,
} from "lucide-react";
import type { QuizAttempt, QuizAttemptResult } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import {
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import {
  getQuizAttempt,
  getQuizAttemptResult,
  saveQuizAnswer,
  submitQuizAttempt,
} from "./quiz-api";
import { QuizResultView } from "./quiz-result-view";

type SaveState = "idle" | "saving" | "saved" | "error" | "offline";

export function QuizAttemptRunner({ attemptId }: { attemptId: string }) {
  const { accessToken } = useAuth();
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef(new Map<string, string[]>());
  const flushingRef = useRef(new Set<string>());
  const submitLockRef = useRef(false);
  const guestToken = useCallback(
    () =>
      accessToken
        ? undefined
        : (localStorage.getItem(`zunibee-guest-attempt-${attemptId}`) ??
          undefined),
    [accessToken, attemptId],
  );

  const flushQuestion = useCallback(
    async (questionId: string) => {
      if (flushingRef.current.has(questionId)) return;
      flushingRef.current.add(questionId);
      try {
        while (pendingRef.current.has(questionId)) {
          if (!navigator.onLine) {
            setSaveState("offline");
            return;
          }
          const selected = pendingRef.current.get(questionId) ?? [];
          pendingRef.current.delete(questionId);
          setSaveState("saving");
          try {
            await saveQuizAnswer(
              attemptId,
              questionId,
              { selectedOptionIds: selected },
              accessToken ?? undefined,
              guestToken(),
            );
          } catch (cause) {
            if (!pendingRef.current.has(questionId))
              pendingRef.current.set(questionId, selected);
            setSaveState(navigator.onLine ? "error" : "offline");
            setError(getErrorMessage(cause));
            return;
          }
        }
      } finally {
        flushingRef.current.delete(questionId);
        if (!pendingRef.current.size && navigator.onLine)
          setSaveState((current) => (current === "error" ? current : "saved"));
      }
    },
    [accessToken, attemptId, guestToken],
  );

  const flushAll = useCallback(async () => {
    const ids = [...pendingRef.current.keys()];
    await Promise.all(ids.map((id) => flushQuestion(id)));
    while (flushingRef.current.size) {
      await new Promise((resolve) => window.setTimeout(resolve, 30));
    }
    if (pendingRef.current.size)
      throw new Error(
        "Vẫn còn đáp án chưa được lưu. Hãy kiểm tra kết nối mạng.",
      );
  }, [flushQuestion]);

  useEffect(() => {
    let active = true;
    getQuizAttempt(attemptId, accessToken ?? undefined, guestToken())
      .then(async (data) => {
        if (data.status !== "in_progress")
          return getQuizAttemptResult(
            attemptId,
            accessToken ?? undefined,
            guestToken(),
          );
        return data;
      })
      .then((data) => {
        if (!active) return;
        if ("attemptId" in data) setResult(data);
        else setAttempt(data);
        setError("");
        setSaveState("saved");
      })
      .catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [accessToken, attemptId, guestToken]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const online = () => {
      setSaveState(pendingRef.current.size ? "saving" : "saved");
      [...pendingRef.current.keys()].forEach((id) => void flushQuestion(id));
    };
    const offline = () => setSaveState("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [flushQuestion]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!pendingRef.current.size && !flushingRef.current.size) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  useEffect(() => {
    if (
      attempt?.deadlineAt &&
      now >= new Date(attempt.deadlineAt).getTime() &&
      !result &&
      !submitLockRef.current
    ) {
      submitLockRef.current = true;
      void flushAll()
        .catch(() => undefined)
        .then(() =>
          submitQuizAttempt(attemptId, accessToken ?? undefined, guestToken()),
        )
        .then(setResult)
        .catch((cause) => setError(getErrorMessage(cause)))
        .finally(() => {
          submitLockRef.current = false;
        });
    }
  }, [accessToken, attempt, attemptId, flushAll, guestToken, now, result]);

  function select(questionId: string, optionId: string, multiple: boolean) {
    if (!attempt || submitting) return;
    const current = attempt.answers[questionId] ?? [];
    const selected = multiple
      ? current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
      : [optionId];
    setAttempt((value) =>
      value
        ? { ...value, answers: { ...value.answers, [questionId]: selected } }
        : value,
    );
    pendingRef.current.set(questionId, selected);
    setSaveState(navigator.onLine ? "saving" : "offline");
    void flushQuestion(questionId);
  }

  async function submit() {
    if (!attempt || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      await flushAll();
      setResult(
        await submitQuizAttempt(
          attempt.id,
          accessToken ?? undefined,
          guestToken(),
        ),
      );
      setConfirmSubmit(false);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }

  if (result) return <QuizResultView result={result} />;
  const remaining = attempt?.deadlineAt
    ? Math.max(
        0,
        Math.ceil((new Date(attempt.deadlineAt).getTime() - now) / 1000),
      )
    : null;
  const answered = attempt
    ? attempt.questions.filter((question) =>
        Boolean(attempt.answers[question.id]?.length),
      ).length
    : 0;
  const unanswered = attempt ? attempt.questions.length - answered : 0;

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">
        {attempt ? (
          <>
            <header className="sticky top-3 z-10 rounded-2xl border-2 border-foreground bg-surface p-4 shadow-brutal-md">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-muted-foreground">
                    Lượt {attempt.attemptNumber} · {answered}/
                    {attempt.questions.length} câu
                  </p>
                  <h1 className="font-display text-xl font-extrabold">
                    {attempt.quizTitle}
                  </h1>
                </div>
                {remaining !== null ? (
                  <span
                    className={`flex items-center gap-2 rounded-xl border-2 border-foreground px-3 py-2 font-extrabold tabular-nums ${remaining <= 60 ? "bg-destructive-soft" : remaining <= 300 ? "bg-warning-soft" : "bg-surface-soft"}`}
                  >
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, "0")}
                  </span>
                ) : null}
              </div>
              <SaveIndicator
                state={saveState}
                onRetry={() =>
                  [...pendingRef.current.keys()].forEach(
                    (id) => void flushQuestion(id),
                  )
                }
              />
            </header>

            {remaining !== null && remaining <= 300 ? (
              <p
                className="mt-5 flex items-center gap-2 rounded-xl border-2 border-foreground bg-warning-soft p-3 font-bold"
                role="status"
              >
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                {remaining <= 60
                  ? "Còn dưới 1 phút. Bài sẽ tự động nộp khi hết giờ."
                  : "Còn dưới 5 phút làm bài."}
              </p>
            ) : null}

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
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 font-semibold transition-colors duration-200 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${checked ? "border-foreground bg-primary" : "border-divider hover:bg-surface-soft"}`}
                        >
                          <input
                            type={
                              question.type === "multiple_choice"
                                ? "checkbox"
                                : "radio"
                            }
                            name={question.id}
                            checked={checked}
                            disabled={submitting}
                            onChange={() =>
                              select(
                                question.id,
                                option.id,
                                question.type === "multiple_choice",
                              )
                            }
                          />
                          {option.content}
                          {checked ? (
                            <CheckCircle2
                              className="ml-auto h-5 w-5"
                              aria-hidden="true"
                            />
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            <button
              type="button"
              disabled={submitting || saveState === "offline"}
              onClick={() => setConfirmSubmit(true)}
              className={`${PRIMARY_ACTION_CLASS} mt-7 w-full`}
            >
              <Send className="h-5 w-5" aria-hidden="true" />
              Nộp bài
            </button>
          </>
        ) : (
          <p className="font-bold">Đang tải lượt làm...</p>
        )}
        {error ? (
          <p
            className="mt-5 rounded-xl border-2 border-foreground bg-destructive-soft p-3 font-bold"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      {confirmSubmit ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
        >
          <div className="w-full max-w-lg rounded-t-3xl border-[3px] border-foreground bg-surface p-6 shadow-brutal-xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="submit-title"
                  className="font-display text-2xl font-extrabold"
                >
                  Xác nhận nộp bài
                </h2>
                <p className="mt-2 font-semibold text-muted-foreground">
                  {unanswered
                    ? `Bạn còn ${unanswered} câu chưa trả lời.`
                    : "Bạn đã trả lời tất cả câu hỏi."}{" "}
                  Sau khi nộp, lượt làm này không thể chỉnh sửa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                aria-label="Đóng"
                className="cursor-pointer rounded-lg p-2 hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmSubmit(false)}
                className={SECONDARY_ACTION_CLASS}
              >
                Tiếp tục làm
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className={PRIMARY_ACTION_CLASS}
              >
                {submitting ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send className="h-5 w-5" aria-hidden="true" />
                )}
                {submitting ? "Đang nộp..." : "Nộp bài ngay"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SaveIndicator({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  const content = {
    idle: [Save, "Chưa có thay đổi"],
    saving: [Loader2, "Đang lưu đáp án..."],
    saved: [CheckCircle2, "Đã lưu tất cả đáp án"],
    error: [AlertTriangle, "Lưu thất bại — thử lại"],
    offline: [CloudOff, "Mất kết nối — đáp án đang chờ lưu"],
  } as const;
  const [Icon, label] = content[state];
  return (
    <button
      type="button"
      onClick={state === "error" || state === "offline" ? onRetry : undefined}
      className={`mt-3 inline-flex items-center gap-2 rounded-lg text-sm font-bold ${state === "error" || state === "offline" ? "cursor-pointer text-destructive underline" : "cursor-default text-muted-foreground"}`}
    >
      <Icon
        className={`h-4 w-4 ${state === "saving" ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}
