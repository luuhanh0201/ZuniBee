"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Download,
  Mail,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import type {
  NotificationOutboxItem,
  QuizAnalytics,
  QuizDetail,
  QuizResultRow,
} from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { quizAttemptRoute } from "@/config/routes";
import {
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import {
  downloadQuizResultsExcel,
  enqueueQuizResultNotifications,
  getQuizAnalytics,
  listQuizResultNotifications,
  regradeQuiz,
} from "./quiz-api";

export function TeacherQuizResults({
  quiz,
  results,
  onReload,
}: {
  quiz: QuizDetail;
  results: QuizResultRow[];
  onReload: () => Promise<void>;
}) {
  const { accessToken } = useAuth();
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null);
  const [notifications, setNotifications] = useState<NotificationOutboxItem[]>(
    [],
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"regrade" | "excel" | "mail" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadInsights() {
    if (!accessToken) return;
    const [nextAnalytics, nextNotifications] = await Promise.all([
      getQuizAnalytics(quiz.id, accessToken),
      listQuizResultNotifications(quiz.id, accessToken),
    ]);
    setAnalytics(nextAnalytics);
    setNotifications(nextNotifications);
  }

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    Promise.all([
      getQuizAnalytics(quiz.id, accessToken),
      listQuizResultNotifications(quiz.id, accessToken),
    ])
      .then(([nextAnalytics, nextNotifications]) => {
        if (!active) return;
        setAnalytics(nextAnalytics);
        setNotifications(nextNotifications);
      })
      .catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [accessToken, quiz.id]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return results.filter((row) =>
      `${row.identityName} ${row.identityEmail ?? ""}`
        .toLocaleLowerCase("vi")
        .includes(normalized),
    );
  }, [query, results]);

  async function regrade() {
    if (!accessToken) return;
    setBusy("regrade");
    try {
      const summary = await regradeQuiz(quiz.id, accessToken);
      await Promise.all([onReload(), loadInsights()]);
      setNotice(`Đã chấm lại ${summary.regradedAttempts} lượt làm.`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function exportExcel() {
    if (!accessToken) return;
    setBusy("excel");
    try {
      await downloadQuizResultsExcel(quiz.id, accessToken);
      setNotice("Đã tạo file Excel gồm kết quả và phân tích câu hỏi.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function sendResults() {
    if (!accessToken) return;
    setBusy("mail");
    try {
      const summary = await enqueueQuizResultNotifications(
        quiz.id,
        accessToken,
      );
      await loadInsights();
      setNotice(
        `Đã xếp hàng ${summary.queued} email; ${summary.alreadyQueued} email đã tồn tại; bỏ qua ${summary.skippedGuests} lượt khách.`,
      );
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  const maxDistribution = Math.max(
    1,
    ...(analytics?.distribution.map((item) => item.count) ?? [1]),
  );
  const sent = notifications.filter((item) => item.status === "sent").length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-extrabold uppercase tracking-wide text-muted-foreground">
            Phân tích lớp học
          </p>
          <h2 className="font-display text-3xl font-extrabold">Kết quả quiz</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {quiz.answersChangedAt ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void regrade()}
              className={PRIMARY_ACTION_CLASS}
            >
              <RefreshCw
                className={`h-4 w-4 ${busy === "regrade" ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Chấm lại
            </button>
          ) : null}
          <button
            type="button"
            disabled={!results.length || busy !== null}
            onClick={() => void exportExcel()}
            className={SECONDARY_ACTION_CLASS}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Xuất Excel
          </button>
          <button
            type="button"
            disabled={!results.length || busy !== null}
            onClick={() => void sendResults()}
            className={SECONDARY_ACTION_CLASS}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Gửi kết quả
          </button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-foreground bg-destructive-soft p-3 font-bold"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-xl border-2 border-foreground bg-success-soft p-3 font-bold"
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Users}
          label="Đã tham gia"
          value={`${analytics?.participantCount ?? 0}/${analytics?.assignedStudents ?? 0}`}
          helper={`${analytics?.completionRate ?? 0}% hoàn thành`}
          color="bg-secondary-soft"
        />
        <Metric
          icon={TrendingUp}
          label="Điểm trung bình"
          value={String(analytics?.averageScore ?? 0)}
          helper={`Cao nhất ${analytics?.highestScore ?? 0}`}
          color="bg-success-soft"
        />
        <Metric
          icon={BarChart3}
          label="Lượt đã nộp"
          value={String(analytics?.submittedAttempts ?? 0)}
          helper={`Thấp nhất ${analytics?.lowestScore ?? 0}`}
          color="bg-warning-soft"
        />
        <Metric
          icon={Mail}
          label="Email kết quả"
          value={`${sent}/${notifications.length}`}
          helper="Đã gửi / đã xếp hàng"
          color="bg-primary"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-sm">
          <h3 className="font-display text-xl font-extrabold">Phân bố điểm</h3>
          <div className="mt-5 space-y-4">
            {analytics?.distribution.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between font-bold">
                  <span>{item.label} điểm</span>
                  <span>{item.count}</span>
                </div>
                <div className="mt-2 h-4 overflow-hidden rounded-full border-2 border-foreground bg-surface-soft">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${(item.count / maxDistribution) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-sm">
          <h3 className="font-display text-xl font-extrabold">
            Độ khó theo câu
          </h3>
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
            {analytics?.questions.map((question, index) => (
              <div
                key={question.questionId}
                className="rounded-xl border-2 border-divider bg-background p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">
                    Câu {index + 1}: {question.content}
                  </p>
                  <span
                    className={`shrink-0 rounded-full border-2 border-foreground px-2 py-1 text-xs font-extrabold ${question.correctRate < 50 ? "bg-destructive-soft" : question.correctRate < 75 ? "bg-warning-soft" : "bg-success-soft"}`}
                  >
                    {question.correctRate}% đúng
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border-2 border-foreground bg-surface shadow-brutal-md">
        <div className="flex flex-col gap-3 border-b-2 border-foreground p-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-display text-xl font-extrabold">
            Chi tiết lượt làm
          </h3>
          <label className="relative block sm:w-72">
            <span className="sr-only">Tìm học sinh</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên hoặc email"
              className="min-h-11 w-full rounded-xl border-2 border-foreground bg-background py-2 pl-9 pr-3 font-semibold outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-surface-soft">
              <tr className="border-b-2 border-foreground">
                <th className="p-3">#</th>
                <th>Học sinh</th>
                <th>Điểm</th>
                <th>Lượt</th>
                <th>Thời gian</th>
                <th>Nộp lúc</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.attemptId}
                  className="border-b border-divider last:border-0 hover:bg-surface-soft"
                >
                  <td className="p-3 font-extrabold">{row.rank}</td>
                  <td>
                    <strong className="block">{row.identityName}</strong>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {row.identityEmail ?? "Khách"}
                    </span>
                  </td>
                  <td className="font-extrabold tabular-nums">
                    {row.score}/{row.maxScore}
                  </td>
                  <td>{row.attemptNumber}</td>
                  <td>{formatDuration(row.timeTakenSeconds)}</td>
                  <td>{new Date(row.submittedAt).toLocaleString("vi-VN")}</td>
                  <td className="pr-3">
                    <Link
                      href={quizAttemptRoute(row.attemptId)}
                      className="cursor-pointer font-extrabold underline underline-offset-4"
                    >
                      Xem bài
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? (
            <p className="p-8 text-center font-bold text-muted-foreground">
              Chưa có lượt nộp phù hợp.
            </p>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  helper,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  helper: string;
  color: string;
}) {
  return (
    <article className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground ${color}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">
        {helper}
      </p>
    </article>
  );
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
