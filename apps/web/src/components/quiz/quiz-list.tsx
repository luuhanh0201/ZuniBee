"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenCheck, Plus, Settings2, Sparkles } from "lucide-react";
import type { QuizSummary } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { ROUTES, teacherQuizRoute } from "@/config/routes";
import {
  TeacherClassroomFrame,
  ClassroomErrorState,
  ClassroomLoadingState,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import { listQuizzes } from "./quiz-api";

export function QuizList() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    listQuizzes(accessToken ?? undefined)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [accessToken, reload]);
  return (
    <TeacherClassroomFrame>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-extrabold uppercase tracking-wide text-muted-foreground">
            Ngân hàng đề
          </p>
          <h1 className="font-display text-4xl font-extrabold">Quiz của tôi</h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            Soạn thủ công, cấu hình và phân phối quiz cho lớp học.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={ROUTES.teacherCreateAiQuiz}
            className={SECONDARY_ACTION_CLASS}
          >
            <Sparkles className="h-5 w-5" />
            Tạo bằng AI
          </Link>
          <Link
            href={ROUTES.teacherCreateQuiz}
            className={PRIMARY_ACTION_CLASS}
          >
            <Plus className="h-5 w-5" />
            Tạo thủ công
          </Link>
        </div>
      </header>
      {!items && !error ? (
        <ClassroomLoadingState label="Đang tải quiz..." />
      ) : null}
      {error ? (
        <ClassroomErrorState
          message={error}
          onRetry={() => {
            setError("");
            setReload((v) => v + 1);
          }}
        />
      ) : null}
      {items?.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-foreground bg-surface p-12 text-center">
          <BookOpenCheck className="mx-auto h-12 w-12" />
          <h2 className="mt-4 font-display text-2xl font-extrabold">
            Chưa có quiz
          </h2>
        </div>
      ) : null}
      {items?.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((quiz) => (
            <article
              key={quiz.id}
              className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md"
            >
              <div className="flex justify-between gap-3">
                <span className="rounded-full border-2 border-foreground bg-secondary-soft px-3 py-1 text-xs font-extrabold">
                  {quiz.status === "published" ? "Đã phát hành" : "Bản nháp"}
                </span>
                <span className="font-extrabold tabular-nums">
                  {quiz.questionCount} câu
                </span>
              </div>
              <h2 className="mt-4 font-display text-xl font-extrabold">
                {quiz.title}
              </h2>
              <p className="mt-2 line-clamp-2 min-h-12 font-semibold text-muted-foreground">
                {quiz.description || "Chưa có mô tả"}
              </p>
              <Link
                href={teacherQuizRoute(quiz.id)}
                className={`${SECONDARY_ACTION_CLASS} mt-5 w-full`}
              >
                <Settings2 className="h-4 w-4" />
                Mở trình soạn
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </TeacherClassroomFrame>
  );
}
