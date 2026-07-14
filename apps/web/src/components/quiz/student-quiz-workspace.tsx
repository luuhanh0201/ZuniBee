"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  Play,
  RotateCcw,
} from "lucide-react";
import type { StudentQuizItem, StudentQuizState } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { publicQuizRoute, quizAttemptRoute } from "@/config/routes";
import {
  ClassroomErrorState,
  ClassroomLoadingState,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import {
  StudentClassroomFrame,
  StudentClassroomPageHeader,
} from "@/components/classroom/student-classroom-frame";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import { listStudentQuizzes } from "./quiz-api";

type Filter = "all" | "todo" | "completed";

const stateMeta: Record<
  StudentQuizState,
  { label: string; color: string; icon: typeof Clock3 }
> = {
  upcoming: {
    label: "Sắp mở",
    color: "bg-secondary-soft",
    icon: CalendarClock,
  },
  available: { label: "Chưa làm", color: "bg-warning-soft", icon: Play },
  in_progress: { label: "Đang làm", color: "bg-primary", icon: Clock3 },
  completed: {
    label: "Đã hoàn thành",
    color: "bg-success-soft",
    icon: CheckCircle2,
  },
  overdue: { label: "Quá hạn", color: "bg-destructive-soft", icon: History },
};

export function StudentQuizWorkspace() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<StudentQuizItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    listStudentQuizzes(accessToken)
      .then((rows) => {
        if (active) {
          setItems(rows);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [accessToken, reload]);

  const visible = useMemo(
    () =>
      (items ?? []).filter((quiz) => {
        if (filter === "completed") return quiz.state === "completed";
        if (filter === "todo")
          return ["available", "in_progress", "upcoming"].includes(quiz.state);
        return true;
      }),
    [filter, items],
  );
  const inProgress =
    items?.filter((item) => item.state === "in_progress").length ?? 0;
  const completed =
    items?.filter((item) => item.state === "completed").length ?? 0;

  return (
    <StudentClassroomFrame>
      <StudentClassroomPageHeader
        title="Quiz của tôi"
        description="Theo dõi bài được giao, tiếp tục lượt đang làm và xem lại kết quả."
      />
      {!items && !error ? (
        <ClassroomLoadingState label="Đang tải danh sách quiz..." />
      ) : null}
      {error ? (
        <ClassroomErrorState
          message={error}
          onRetry={() => {
            setError("");
            setReload((value) => value + 1);
          }}
        />
      ) : null}
      {items ? (
        <>
          <section
            className="grid gap-4 sm:grid-cols-3"
            aria-label="Tổng quan quiz"
          >
            <SummaryCard
              label="Được giao"
              value={items.length}
              color="bg-secondary-soft"
            />
            <SummaryCard
              label="Đang làm"
              value={inProgress}
              color="bg-warning-soft"
            />
            <SummaryCard
              label="Hoàn thành"
              value={completed}
              color="bg-success-soft"
            />
          </section>
          <div
            className="mt-7 flex flex-wrap gap-2"
            role="group"
            aria-label="Lọc quiz"
          >
            {(
              [
                ["all", "Tất cả"],
                ["todo", "Cần hoàn thành"],
                ["completed", "Lịch sử"],
              ] as Array<[Filter, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`min-h-11 cursor-pointer rounded-xl border-2 border-foreground px-4 font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${filter === id ? "bg-primary shadow-brutal-sm" : "bg-surface hover:bg-surface-soft"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((quiz) => (
              <StudentQuizCard key={quiz.id} quiz={quiz} />
            ))}
          </section>
          {!visible.length ? (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-foreground bg-surface p-10 text-center">
              <BookOpenCheck className="mx-auto h-10 w-10" aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-extrabold">
                Chưa có quiz trong nhóm này
              </h2>
            </div>
          ) : null}
        </>
      ) : null}
    </StudentClassroomFrame>
  );
}

function StudentQuizCard({ quiz }: { quiz: StudentQuizItem }) {
  const meta = stateMeta[quiz.state];
  const Icon = meta.icon;
  const href = quiz.inProgressAttemptId
    ? quizAttemptRoute(quiz.inProgressAttemptId)
    : quiz.state === "completed" && quiz.latestResult
      ? quizAttemptRoute(quiz.latestResult.attemptId)
      : publicQuizRoute(quiz.id);
  const disabled = quiz.state === "upcoming" || quiz.state === "overdue";
  return (
    <article className="flex min-h-72 flex-col rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground shadow-brutal-sm ${meta.color}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span
          className={`rounded-full border-2 border-foreground px-3 py-1 text-xs font-extrabold ${meta.color}`}
        >
          {meta.label}
        </span>
      </div>
      <p className="mt-4 text-sm font-bold text-muted-foreground">
        {quiz.teacherName}
      </p>
      <h2 className="mt-1 font-display text-xl font-extrabold">{quiz.title}</h2>
      <p className="mt-2 line-clamp-2 font-semibold text-muted-foreground">
        {quiz.description ||
          `${quiz.questionCount} câu · ${quiz.totalScore} điểm`}
      </p>
      <div className="mt-4 space-y-1 text-sm font-bold text-muted-foreground">
        <p>
          {quiz.questionCount} câu · Đã dùng {quiz.attemptsUsed}/
          {quiz.maxAttempts ?? "∞"} lượt
        </p>
        <p>{formatSchedule(quiz.opensAt, quiz.dueAt)}</p>
        {quiz.latestResult ? (
          <p className="text-foreground">
            Điểm gần nhất:{" "}
            {quiz.latestResult.score === null
              ? "Chưa công bố"
              : `${quiz.latestResult.score}/${quiz.latestResult.maxScore}`}
          </p>
        ) : null}
      </div>
      <div className="mt-auto pt-5">
        {disabled ? (
          <span
            className={`${SECONDARY_ACTION_CLASS} w-full cursor-not-allowed opacity-60`}
            aria-disabled="true"
          >
            {quiz.state === "upcoming" ? "Chưa đến giờ mở" : "Đã quá hạn"}
          </span>
        ) : (
          <Link
            href={href}
            className={`${quiz.state === "in_progress" ? PRIMARY_ACTION_CLASS : SECONDARY_ACTION_CLASS} w-full`}
          >
            {quiz.state === "in_progress" ? (
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {quiz.state === "in_progress"
              ? "Tiếp tục làm"
              : quiz.state === "completed"
                ? "Xem kết quả"
                : "Bắt đầu"}
          </Link>
        )}
      </div>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <article
      className={`rounded-2xl border-2 border-foreground p-5 shadow-brutal-sm ${color}`}
    >
      <p className="font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">
        {value}
      </p>
    </article>
  );
}

function formatSchedule(opensAt: string | null, dueAt: string | null): string {
  if (dueAt)
    return `Hạn ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(dueAt))}`;
  if (opensAt)
    return `Mở ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(opensAt))}`;
  return "Không giới hạn thời gian truy cập";
}
