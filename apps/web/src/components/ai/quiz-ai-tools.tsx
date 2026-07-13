"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Mail, RefreshCw, Sparkles } from "lucide-react";
import type {
  NotificationOutboxItem,
  QuizWeaknessInsight,
} from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import {
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import {
  enqueueQuizResultNotifications,
  generateQuizInsight,
  getQuizInsight,
  listQuizResultNotifications,
} from "./ai-api";

export function QuizAiTools({
  quizId,
  hasResults,
}: {
  quizId: string;
  hasResults: boolean;
}) {
  const { accessToken } = useAuth();
  const [insight, setInsight] = useState<QuizWeaknessInsight | null>(null);
  const [notifications, setNotifications] = useState<NotificationOutboxItem[]>(
    [],
  );
  const [busy, setBusy] = useState<"insight" | "mail" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    if (!accessToken) return;
    const [insightRow, notificationRows] = await Promise.all([
      getQuizInsight(quizId, accessToken),
      listQuizResultNotifications(quizId, accessToken),
    ]);
    setInsight(insightRow);
    setNotifications(notificationRows);
  }
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    Promise.all([
      getQuizInsight(quizId, accessToken),
      listQuizResultNotifications(quizId, accessToken),
    ])
      .then(([insightRow, notificationRows]) => {
        if (!active) return;
        setInsight(insightRow);
        setNotifications(notificationRows);
      })
      .catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [accessToken, quizId]);
  async function analyze() {
    if (!accessToken) return;
    setBusy("insight");
    setError("");
    setNotice("");
    try {
      setInsight(await generateQuizInsight(quizId, accessToken));
      setNotice("Đã phân tích điểm mạnh và điểm yếu từ dữ liệu bài làm.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }
  async function notify() {
    if (!accessToken) return;
    setBusy("mail");
    setError("");
    setNotice("");
    try {
      const summary = await enqueueQuizResultNotifications(quizId, accessToken);
      setNotice(
        `Đã đưa ${summary.queued} email vào hàng đợi; bỏ qua ${summary.skippedGuests} lượt Guest; ${summary.alreadyQueued} email đã tồn tại.`,
      );
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  }
  const sent = notifications.filter((item) => item.status === "sent").length;
  const failed = notifications.filter(
    (item) => item.status === "failed",
  ).length;
  return (
    <div className="mt-8 grid gap-5 border-t-2 border-foreground pt-6 lg:grid-cols-2">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-foreground bg-destructive-soft p-3 font-bold lg:col-span-2"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-xl border-2 border-foreground bg-success-soft p-3 font-bold lg:col-span-2"
        >
          {notice}
        </p>
      ) : null}
      <section className="rounded-2xl border-2 border-foreground bg-secondary-soft p-5 shadow-brutal-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-xl font-extrabold">
              <BrainCircuit className="h-5 w-5" />
              AI phân tích điểm yếu
            </h3>
            <p className="mt-1 font-semibold text-muted-foreground">
              Dữ liệu được tổng hợp, không gửi tên học sinh cho AI.
            </p>
          </div>
          <button
            disabled={!hasResults || busy !== null}
            onClick={() => void analyze()}
            className={PRIMARY_ACTION_CLASS}
          >
            {insight ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy === "insight"
              ? "Đang phân tích..."
              : insight
                ? "Phân tích lại"
                : "Phân tích"}
          </button>
        </div>
        {insight?.status === "succeeded" ? (
          <div className="mt-5 space-y-4">
            <p className="font-bold">{insight.summary}</p>
            <InsightList title="Điểm mạnh" items={insight.strengths} />
            <InsightList title="Điểm yếu" items={insight.weaknesses} />
            <InsightList title="Khuyến nghị" items={insight.recommendations} />
            <p className="text-sm font-bold text-muted-foreground">
              Mẫu: {insight.sampleSize} lượt · {insight.chargedCredits} credit
            </p>
          </div>
        ) : null}
      </section>
      <section className="rounded-2xl border-2 border-foreground bg-warning-soft p-5 shadow-brutal-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-xl font-extrabold">
              <Mail className="h-5 w-5" />
              Gửi kết quả hàng loạt
            </h3>
            <p className="mt-1 font-semibold text-muted-foreground">
              Transactional outbox + Redis retry; Guest luôn bị loại.
            </p>
          </div>
          <button
            disabled={!hasResults || busy !== null}
            onClick={() => void notify()}
            className={SECONDARY_ACTION_CLASS}
          >
            <Mail className="h-4 w-4" />
            {busy === "mail" ? "Đang xếp hàng..." : "Gửi kết quả"}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Metric label="Tổng" value={notifications.length} />
          <Metric label="Đã gửi" value={sent} />
          <Metric label="Lỗi" value={failed} />
        </div>
        {failed ? (
          <p className="mt-3 font-bold text-destructive">
            Email lỗi sẽ giữ trạng thái để Admin kiểm tra và chạy lại.
          </p>
        ) : null}
      </section>
    </div>
  );
}
function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-extrabold">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 font-semibold">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border-2 border-foreground bg-surface p-3">
      <strong className="block font-display text-2xl tabular-nums">
        {value}
      </strong>
      <span className="text-xs font-extrabold">{label}</span>
    </div>
  );
}
