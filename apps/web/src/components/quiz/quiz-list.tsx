"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenCheck, Plus, Settings2, Sparkles } from "lucide-react";
import type { QuizSummary } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { ROUTES, teacherQuizRoute } from "@/config/routes";
import {
  TeacherClassroomFrame,
  ClassroomPageHeader,
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
      <ClassroomPageHeader
        title="Nội dung học"
        description="Tạo, kiểm tra và phân phối các hoạt động học. Quiz là một định dạng trong thư viện nội dung của bạn."
        actions={
          <>
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
          </>
        }
      />
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
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-12 text-center">
          <BookOpenCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-2xl font-bold">
            Chưa có nội dung học
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Bắt đầu từ tài liệu với AI hoặc tự tạo hoạt động đầu tiên.
          </p>
        </div>
      ) : null}
      {items?.length ? (
        <div className="divide-y divide-divider overflow-hidden rounded-2xl border border-divider bg-surface">
          {items.map((quiz) => (
            <article
              key={quiz.id}
              className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-divider bg-secondary-soft px-3 py-1 text-xs font-semibold">
                    {quiz.status === "published" ? "Đã phát hành" : "Bản nháp"}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-muted-foreground">
                    {quiz.questionCount} câu
                  </span>
                </div>
                <h2 className="mt-3 font-display text-xl font-bold">
                  {quiz.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-muted-foreground">
                  {quiz.description || "Chưa có mô tả"}
                </p>
              </div>
              <Link
                href={teacherQuizRoute(quiz.id)}
                className={SECONDARY_ACTION_CLASS}
              >
                <Settings2 className="h-4 w-4" />
                Tiếp tục soạn
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </TeacherClassroomFrame>
  );
}
