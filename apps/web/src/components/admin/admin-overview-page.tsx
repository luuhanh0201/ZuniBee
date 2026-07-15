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
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import { getUserErrorMessage } from "@/lib/api-client";
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
  const [roleCounts, setRoleCounts] = useState({
    student: 0,
    teacher: 0,
    admin: 0,
  });
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
        setRoleCounts(userRows.roleCounts);
      })
      .catch((cause: unknown) =>
        setError(getUserErrorMessage(cause, "Không tải được tổng quan")),
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

  const trendData =
    usage?.timeseries.map((point) => ({
      label: formatChartBucket(point.bucket),
      requests: point.requests,
      errors: point.failedRequests,
    })) ?? [];
  const roleData = [
    {
      name: "Học sinh",
      value: roleCounts.student,
      color: "var(--primary)",
    },
    {
      name: "Giáo viên",
      value: roleCounts.teacher,
      color: "var(--secondary)",
    },
    {
      name: "Quản trị viên",
      value: roleCounts.admin,
      color: "var(--muted-foreground)",
    },
  ];
  const hasRoleData = roleData.some((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Vận hành trực tiếp
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
          label="Tổng người dùng"
          value={formatNumber(userTotal)}
          helper="Tổng tài khoản trong hệ thống"
          color="bg-warning-soft"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <article className="rounded-2xl border border-divider bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Xu hướng request AI</h3>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Request thành công và lỗi trong khoảng thời gian đang thống kê.
              </p>
            </div>
            <Link
              href={ROUTES.adminAiUsage}
              className="cursor-pointer rounded-lg text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Xem chi tiết
            </Link>
          </div>
          {trendData.length ? (
            <div
              className="mt-5 h-72 w-full"
              role="img"
              aria-label="Biểu đồ đường xu hướng request AI và request lỗi"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  accessibilityLayer
                >
                  <CartesianGrid
                    stroke="var(--divider)"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    minTickGap={28}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--divider)",
                      borderRadius: 12,
                      boxShadow: "var(--shadow-brutal-sm)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    name="Request"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    name="Lỗi"
                    stroke="var(--destructive)"
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-divider bg-surface-soft p-8 text-center text-sm font-medium text-muted-foreground">
              Chưa có dữ liệu theo thời gian để vẽ biểu đồ.
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-divider bg-surface p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-bold">Phân bố vai trò</h3>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Tài khoản thật hiện có trong hệ thống.
          </p>
          {hasRoleData ? (
            <>
              <div
                className="mx-auto mt-3 h-52 w-full max-w-xs"
                role="img"
                aria-label="Biểu đồ donut phân bố học sinh, giáo viên và quản trị viên"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart accessibilityLayer>
                    <Pie
                      data={roleData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={3}
                      stroke="var(--surface)"
                      strokeWidth={3}
                    >
                      {roleData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--divider)",
                        borderRadius: 12,
                        boxShadow: "var(--shadow-brutal-sm)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-2" aria-label="Chi tiết vai trò">
                {roleData.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2 font-medium text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      {item.name}
                    </span>
                    <strong className="font-semibold tabular-nums">
                      {formatNumber(item.value)}
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-divider bg-surface-soft p-8 text-center text-sm font-medium text-muted-foreground">
              Chưa có tài khoản để phân tích vai trò.
            </p>
          )}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-divider bg-surface p-5 shadow-sm">
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
        <div className="rounded-2xl border border-divider bg-surface p-5 shadow-sm">
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

function formatChartBucket(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    ...(value.includes("T") ? { hour: "2-digit" } : {}),
  }).format(date);
}
