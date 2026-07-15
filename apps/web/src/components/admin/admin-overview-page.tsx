"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  CloudCog,
  Loader2,
  Users,
} from "lucide-react";
import type { AiProviderMetrics, AiUsageAnalytics } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/config/routes";
import {
  adminGetAiProviderMetrics,
  adminGetAiUsageAnalytics,
  adminSearchCreditUsers,
} from "@/components/ai/ai-api";
import { MetricCard, formatNumber } from "@/components/ai/metric-card";

export function AdminOverviewPage() {
  const { accessToken } = useAuth();
  const [metrics, setMetrics] = useState<AiProviderMetrics | null>(null);
  const [usage, setUsage] = useState<AiUsageAnalytics | null>(null);
  const [userTotal, setUserTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    Promise.all([
      adminGetAiProviderMetrics(accessToken),
      adminGetAiUsageAnalytics(
        { from: from.toISOString(), to: now.toISOString(), limit: 8 },
        accessToken,
      ),
      adminSearchCreditUsers("", { page: 1, pageSize: 8 }, accessToken),
    ])
      .then(([providerMetrics, analytics, userRows]) => {
        setMetrics(providerMetrics);
        setUsage(analytics);
        setUserTotal(userRows.pagination.total);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Không tải được tổng quan",
        ),
      )
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 font-extrabold text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" /> Đang tổng hợp dữ liệu hệ
        thống...
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <p className="font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Live operations
        </p>
        <h2 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
          Tổng quan quản trị
        </h2>
        <p className="mt-2 font-semibold text-muted-foreground">
          Tình trạng hiện tại lấy từ provider, usage event và tài khoản thật.
        </p>
      </div>
      {error ? (
        <div className="rounded-xl border-2 border-destructive bg-destructive-soft p-4 font-extrabold">
          {error}
        </div>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CloudCog}
          label="Provider hoạt động"
          value={`${metrics?.activeProviders ?? 0}/${metrics?.totalProviders ?? 0}`}
          helper={`${metrics?.onlineProviders ?? 0} provider kiểm tra online`}
          color="bg-success-soft"
        />
        <MetricCard
          icon={Activity}
          label="Request tháng này"
          value={formatNumber(usage?.summary.requests ?? 0)}
          helper={`${formatNumber(usage?.summary.failedRequests ?? 0)} request lỗi`}
          color="bg-secondary-soft"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Chi phí tháng này"
          value={formatUsd(usage?.summary.costUsd ?? 0)}
          helper={`${formatNumber(usage?.summary.unpricedRequests ?? 0)} request thiếu giá`}
          color="bg-primary"
        />
        <MetricCard
          icon={Users}
          label="User gần nhất"
          value={formatNumber(userTotal)}
          helper="Tổng tài khoản trong hệ thống"
          color="bg-warning-soft"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl font-extrabold">
              Cảnh báo cần xử lý
            </h3>
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <div className="mt-4 space-y-3">
            <AlertRow
              bad={
                (metrics?.activeProviders ?? 0) >
                (metrics?.onlineProviders ?? 0)
              }
              text={`${Math.max(0, (metrics?.activeProviders ?? 0) - (metrics?.onlineProviders ?? 0))} provider active chưa xác nhận online`}
              href={ROUTES.adminAiProviders}
            />
            <AlertRow
              bad={(usage?.summary.failedRequests ?? 0) > 0}
              text={`${formatNumber(usage?.summary.failedRequests ?? 0)} request AI lỗi trong tháng`}
              href={ROUTES.adminAiUsage}
            />
            <AlertRow
              bad={(usage?.summary.unpricedRequests ?? 0) > 0}
              text={`${formatNumber(usage?.summary.unpricedRequests ?? 0)} request chưa tính được chi phí`}
              href={ROUTES.adminAiProviders}
            />
            <AlertRow
              bad={Boolean(
                usage?.budgets.some((budget) => budget.state !== "safe"),
              )}
              text={`${usage?.budgets.filter((budget) => budget.state !== "safe").length ?? 0} ngân sách đang cảnh báo hoặc vượt mức`}
              href={ROUTES.adminAiUsage}
            />
          </div>
        </div>
        <div className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md">
          <h3 className="font-display text-2xl font-extrabold">
            Request gần nhất
          </h3>
          <div className="mt-4 space-y-2">
            {!usage?.events.length ? (
              <p className="rounded-xl border-2 border-dashed border-divider p-5 text-center font-bold text-muted-foreground">
                Chưa có usage event.
              </p>
            ) : (
              usage.events.slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-divider bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">
                      {event.providerName}
                    </p>
                    <p className="truncate text-xs font-bold text-muted-foreground">
                      {event.model} · {event.source}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border-2 border-foreground px-2 py-1 text-xs font-extrabold ${event.status === "success" ? "bg-success-soft" : "bg-destructive-soft"}`}
                  >
                    {event.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function AlertRow({
  bad,
  text,
  href,
}: {
  bad: boolean;
  text: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border-2 border-foreground px-3 font-bold ${bad ? "bg-warning-soft" : "bg-success-soft"}`}
    >
      <span>{bad ? text : `Ổn định · ${text}`}</span>
      <ArrowRight className="h-5 w-5 shrink-0" />
    </Link>
  );
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}
