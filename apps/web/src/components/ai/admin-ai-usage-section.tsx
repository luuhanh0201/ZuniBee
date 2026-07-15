"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Gauge,
  Loader2,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import type {
  AiProvider,
  AiUsageAnalytics,
  AiUsageAnalyticsFilters,
  AiUsageBreakdownRow,
  AiUsageBudgetPeriod,
  AiUsageBudgetScope,
  AiUsageSource,
  AiUsageStatus,
  UpsertAiUsageBudgetRequest,
} from "@zunibee/shared";
import {
  adminCreateAiUsageBudget,
  adminDeleteAiUsageBudget,
  adminExportAiUsage,
  adminGetAiUsageAnalytics,
  adminListAiProviders,
  adminUpdateAiUsageBudget,
} from "./ai-api";
import { MetricCard, formatNumber } from "./metric-card";
import { Pagination, paginateItems } from "@/components/admin/pagination";
import { getUserErrorMessage } from "@/lib/api-client";

const controlClass =
  "min-h-11 rounded-xl border-2 border-foreground bg-background px-3 font-bold outline-none focus:ring-2 focus:ring-ring";
const buttonFocus =
  "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring";

const sourceLabels: Record<AiUsageSource, string> = {
  quiz_generation: "Tạo quiz",
  quiz_insight: "Phân tích quiz",
  document_vision_ocr: "AI đọc ảnh / OCR",
};
const statusLabels: Record<AiUsageStatus, string> = {
  success: "Thành công",
  failed: "Thất bại",
  refused: "Bị từ chối",
  timeout: "Quá thời gian",
  invalid_output: "Output không hợp lệ",
};

type DraftFilters = {
  from: string;
  to: string;
  providerId: string;
  model: string;
  source: "" | AiUsageSource;
  status: "" | AiUsageStatus;
  search: string;
};

function toDateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultFilters(): DraftFilters {
  const from = new Date();
  from.setUTCDate(1);
  return {
    from: toDateValue(from),
    to: toDateValue(new Date()),
    providerId: "",
    model: "",
    source: "",
    status: "",
    search: "",
  };
}

function toApiFilters(
  filters: DraftFilters,
  eventPage = 1,
  eventPageSize = 20,
): AiUsageAnalyticsFilters {
  return {
    from: new Date(`${filters.from}T00:00:00.000Z`).toISOString(),
    to: new Date(`${filters.to}T23:59:59.999Z`).toISOString(),
    providerId: filters.providerId || undefined,
    model: filters.model.trim() || undefined,
    source: filters.source || undefined,
    status: filters.status || undefined,
    search: filters.search.trim() || undefined,
    eventPage,
    eventPageSize,
  };
}

export function AdminAiUsageSection({
  accessToken,
}: {
  accessToken: string | null;
}) {
  const [draft, setDraft] = useState<DraftFilters>(defaultFilters);
  const [applied, setApplied] = useState<DraftFilters>(defaultFilters);
  const [analytics, setAnalytics] = useState<AiUsageAnalytics | null>(null);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [breakdown, setBreakdown] = useState<"provider" | "model" | "source">(
    "provider",
  );
  const [breakdownPage, setBreakdownPage] = useState(1);
  const [breakdownPageSize, setBreakdownPageSize] = useState(10);
  const [eventPage, setEventPage] = useState(1);
  const [eventPageSize, setEventPageSize] = useState(20);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [usage, providerRows] = await Promise.all([
        adminGetAiUsageAnalytics(
          toApiFilters(applied, eventPage, eventPageSize),
          accessToken,
        ),
        adminListAiProviders(accessToken),
      ]);
      setAnalytics(usage);
      setProviders(providerRows);
      setError("");
    } catch (cause) {
      setError(getUserErrorMessage(cause, "Không thể tải dữ liệu thống kê AI"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, applied, eventPage, eventPageSize]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    Promise.all([
      adminGetAiUsageAnalytics(
        toApiFilters(applied, eventPage, eventPageSize),
        accessToken,
      ),
      adminListAiProviders(accessToken),
    ])
      .then(([usage, providerRows]) => {
        if (!active) return;
        setAnalytics(usage);
        setProviders(providerRows);
        setError("");
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            getUserErrorMessage(cause, "Không thể tải dữ liệu thống kê AI"),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, applied, eventPage, eventPageSize]);

  const rows = useMemo(() => {
    if (!analytics) return [];
    if (breakdown === "model") return analytics.byModel;
    if (breakdown === "source") return analytics.bySource;
    return analytics.byProvider;
  }, [analytics, breakdown]);
  const paginatedBreakdown = useMemo(
    () => paginateItems(rows, breakdownPage, breakdownPageSize),
    [rows, breakdownPage, breakdownPageSize],
  );

  const summary = analytics?.summary;
  const previous = analytics?.previousSummary;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
            Usage intelligence
          </p>
          <h2 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            Kiểm soát chi phí & chất lượng AI
          </h2>
          <p className="mt-2 max-w-3xl font-semibold text-muted-foreground">
            Dữ liệu thật từ từng request: token, USD, lỗi, độ trễ, OCR bằng AI
            và cảnh báo ngân sách.
          </p>
        </div>
        <button
          type="button"
          disabled={!analytics || exporting}
          onClick={async () => {
            if (!accessToken) return;
            setExporting(true);
            try {
              await adminExportAiUsage(toApiFilters(applied), accessToken);
            } catch (cause) {
              setError(getUserErrorMessage(cause, "Không thể xuất Excel"));
            } finally {
              setExporting(false);
            }
          }}
          className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-success-soft px-4 font-extrabold shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-50 ${buttonFocus}`}
        >
          {exporting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
          Xuất Excel
        </button>
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setEventPage(1);
          setBreakdownPage(1);
          setApplied({ ...draft });
        }}
        className="grid gap-3 rounded-2xl border-2 border-foreground bg-surface p-4 shadow-brutal-md sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
      >
        <FilterField label="Từ ngày">
          <input
            type="date"
            value={draft.from}
            max={draft.to}
            onChange={(event) =>
              setDraft((value) => ({ ...value, from: event.target.value }))
            }
            className={`${controlClass} w-full`}
          />
        </FilterField>
        <FilterField label="Đến ngày">
          <input
            type="date"
            value={draft.to}
            min={draft.from}
            onChange={(event) =>
              setDraft((value) => ({ ...value, to: event.target.value }))
            }
            className={`${controlClass} w-full`}
          />
        </FilterField>
        <FilterField label="Provider">
          <select
            value={draft.providerId}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                providerId: event.target.value,
              }))
            }
            className={`${controlClass} w-full`}
          >
            <option value="">Tất cả</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Model">
          <input
            value={draft.model}
            placeholder="Tên model"
            onChange={(event) =>
              setDraft((value) => ({ ...value, model: event.target.value }))
            }
            className={`${controlClass} w-full`}
          />
        </FilterField>
        <FilterField label="Nguồn gọi">
          <select
            value={draft.source}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                source: event.target.value as DraftFilters["source"],
              }))
            }
            className={`${controlClass} w-full`}
          >
            <option value="">Tất cả</option>
            {Object.entries(sourceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Trạng thái">
          <select
            value={draft.status}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                status: event.target.value as DraftFilters["status"],
              }))
            }
            className={`${controlClass} w-full`}
          >
            <option value="">Tất cả</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Tìm log" wide>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <input
              value={draft.search}
              placeholder="Model, lỗi, user ID..."
              onChange={(event) =>
                setDraft((value) => ({ ...value, search: event.target.value }))
              }
              className={`${controlClass} w-full pl-10`}
            />
          </div>
        </FilterField>
        <button
          type="submit"
          disabled={loading}
          className={`min-h-11 cursor-pointer self-end rounded-xl border-2 border-foreground bg-primary px-5 font-extrabold shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-50 ${buttonFocus}`}
        >
          Áp dụng
        </button>
      </form>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border-2 border-destructive bg-destructive-soft p-4 font-extrabold"
        >
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CircleDollarSign}
          label="Tổng chi phí"
          value={formatUsd(summary?.costUsd ?? 0)}
          helper={comparison(summary?.costUsd, previous?.costUsd, "kỳ trước")}
          color="bg-primary"
        />
        <MetricCard
          icon={Activity}
          label="Tổng request"
          value={formatNumber(summary?.requests ?? 0)}
          helper={comparison(summary?.requests, previous?.requests, "kỳ trước")}
          color="bg-secondary-soft"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Tỷ lệ thành công"
          value={`${(summary?.successRate ?? 0).toFixed(1)}%`}
          helper={`${formatNumber(summary?.failedRequests ?? 0)} request lỗi`}
          color="bg-success-soft"
        />
        <MetricCard
          icon={Gauge}
          label="P95 độ trễ"
          value={
            summary?.p95LatencyMs == null
              ? "--"
              : `${formatNumber(Math.round(summary.p95LatencyMs))} ms`
          }
          helper={
            summary?.averageLatencyMs == null
              ? "Chưa có dữ liệu latency"
              : `Trung bình ${formatNumber(Math.round(summary.averageLatencyMs))} ms`
          }
          color="bg-warning-soft"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <div className="rounded-2xl border-2 border-foreground bg-surface p-4 shadow-brutal-md sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-extrabold">
                Xu hướng chi phí
              </h3>
              <p className="font-semibold text-muted-foreground">
                Theo {granularityLabel(analytics?.granularity)} · đường đỏ là
                request lỗi
              </p>
            </div>
            <span className="rounded-full border-2 border-foreground bg-surface-soft px-3 py-1 text-sm font-extrabold">
              {formatNumber(summary?.inputTokens ?? 0)} in /{" "}
              {formatNumber(summary?.outputTokens ?? 0)} out
            </span>
          </div>
          <UsageTrendChart data={analytics?.timeseries ?? []} />
        </div>
        <BudgetPanel
          analytics={analytics}
          providers={providers}
          accessToken={accessToken}
          onChanged={load}
        />
      </section>

      <section className="rounded-2xl border-2 border-foreground bg-surface shadow-brutal-md">
        <div className="flex flex-col gap-3 border-b-2 border-foreground p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h3 className="font-display text-2xl font-extrabold">
              Phân tích chi tiết
            </h3>
            <p className="font-semibold text-muted-foreground">
              So sánh request, lỗi, chi phí và latency theo từng chiều.
            </p>
          </div>
          <div className="flex rounded-xl border-2 border-foreground bg-background p-1">
            {(["provider", "model", "source"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setBreakdown(value);
                  setBreakdownPage(1);
                }}
                className={`min-h-9 cursor-pointer rounded-lg px-3 text-sm font-extrabold ${breakdown === value ? "bg-primary" : "hover:bg-surface-soft"} ${buttonFocus}`}
              >
                {value === "provider"
                  ? "Provider"
                  : value === "model"
                    ? "Model"
                    : "Nguồn"}
              </button>
            ))}
          </div>
        </div>
        <BreakdownTable
          rows={paginatedBreakdown.items}
          loading={loading}
          dimension={breakdown}
        />
        {!loading ? (
          <Pagination
            {...paginatedBreakdown.pagination}
            itemLabel="nhóm thống kê"
            onPageChange={setBreakdownPage}
            onPageSizeChange={(pageSize) => {
              setBreakdownPageSize(pageSize);
              setBreakdownPage(1);
            }}
          />
        ) : null}
      </section>

      <EventLog
        analytics={analytics}
        loading={loading}
        onPageChange={(page) => {
          setLoading(true);
          setEventPage(page);
        }}
        onPageSizeChange={(pageSize) => {
          setLoading(true);
          setEventPageSize(pageSize);
          setEventPage(1);
        }}
      />
    </div>
  );
}

function FilterField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block font-extrabold ${wide ? "xl:col-span-2" : ""}`}>
      <span className="mb-2 block text-sm">{label}</span>
      {children}
    </label>
  );
}

function UsageTrendChart({ data }: { data: AiUsageAnalytics["timeseries"] }) {
  if (!data.length)
    return (
      <div className="mt-4 flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-divider font-bold text-muted-foreground">
        Chưa có dữ liệu trong khoảng đã chọn
      </div>
    );
  const width = 900;
  const height = 260;
  const pad = 28;
  const maxCost = Math.max(...data.map((point) => point.costUsd), 0.000001);
  const maxRequests = Math.max(...data.map((point) => point.requests), 1);
  const x = (index: number) =>
    pad + (index * (width - pad * 2)) / Math.max(1, data.length - 1);
  const yCost = (value: number) =>
    height - pad - (value / maxCost) * (height - pad * 2);
  const yRequests = (value: number) =>
    height - pad - (value / maxRequests) * (height - pad * 2);
  const costPoints = data
    .map((point, index) => `${x(index)},${yCost(point.costUsd)}`)
    .join(" ");
  const failurePoints = data
    .map((point, index) => `${x(index)},${yRequests(point.failedRequests)}`)
    .join(" ");
  return (
    <div className="mt-4 overflow-hidden rounded-xl border-2 border-foreground bg-background p-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-64 w-full"
        role="img"
        aria-label="Biểu đồ xu hướng chi phí và request lỗi"
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={pad}
            x2={width - pad}
            y1={pad + ratio * (height - pad * 2)}
            y2={pad + ratio * (height - pad * 2)}
            stroke="currentColor"
            opacity="0.12"
            strokeDasharray="6 6"
          />
        ))}
        <polyline
          points={costPoints}
          fill="none"
          stroke="var(--color-primary, #f4c430)"
          strokeWidth="8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={failurePoints}
          fill="none"
          stroke="var(--color-destructive, #dc2626)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeDasharray="7 6"
        />
        {data.map((point, index) => (
          <circle
            key={point.bucket}
            cx={x(index)}
            cy={yCost(point.costUsd)}
            r="5"
            fill="currentColor"
          >
            <title>{`${new Date(point.bucket).toLocaleString("vi-VN")}: ${formatUsd(point.costUsd)}, ${point.requests} requests, ${point.failedRequests} lỗi`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between px-3 pb-1 text-xs font-bold text-muted-foreground">
        <span>{new Date(data[0].bucket).toLocaleDateString("vi-VN")}</span>
        <span>{formatUsd(maxCost)} cao nhất</span>
        <span>
          {new Date(data[data.length - 1].bucket).toLocaleDateString("vi-VN")}
        </span>
      </div>
    </div>
  );
}

function BreakdownTable({
  rows,
  loading,
  dimension,
}: {
  rows: AiUsageBreakdownRow[];
  loading: boolean;
  dimension: "provider" | "model" | "source";
}) {
  if (loading)
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 font-bold text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Đang phân tích...
      </div>
    );
  if (!rows.length)
    return (
      <p className="p-8 text-center font-bold text-muted-foreground">
        Không có dữ liệu phù hợp bộ lọc.
      </p>
    );
  return (
    <div className="overflow-x-auto p-4 sm:p-5">
      <table className="w-full min-w-[840px] border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-foreground text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">
              {dimension === "source" ? "Nguồn" : dimension}
            </th>
            <th className="px-3 py-2 text-right">Request</th>
            <th className="px-3 py-2 text-right">Lỗi</th>
            <th className="px-3 py-2 text-right">Success</th>
            <th className="px-3 py-2 text-right">Tokens</th>
            <th className="px-3 py-2 text-right">Latency TB</th>
            <th className="px-3 py-2 text-right">Chi phí</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-divider font-semibold">
              <td className="max-w-xs px-3 py-3 font-extrabold">
                <span className="block truncate" title={row.label}>
                  {dimension === "source"
                    ? (sourceLabels[row.key as AiUsageSource] ?? row.label)
                    : row.label}
                </span>
                {row.unpricedRequests ? (
                  <small className="text-warning-foreground">
                    {row.unpricedRequests} request thiếu giá
                  </small>
                ) : null}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {formatNumber(row.requests)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-destructive">
                {formatNumber(row.failedRequests)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {row.requests
                  ? `${(((row.requests - row.failedRequests) / row.requests) * 100).toFixed(1)}%`
                  : "--"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {formatNumber(row.inputTokens + row.outputTokens)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {row.averageLatencyMs == null
                  ? "--"
                  : `${formatNumber(Math.round(row.averageLatencyMs))} ms`}
              </td>
              <td className="px-3 py-3 text-right font-extrabold tabular-nums">
                {formatUsd(row.costUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventLog({
  analytics,
  loading,
  onPageChange,
  onPageSizeChange,
}: {
  analytics: AiUsageAnalytics | null;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <section className="rounded-2xl border-2 border-foreground bg-surface shadow-brutal-md">
      <div className="border-b-2 border-foreground p-4 sm:p-5">
        <h3 className="font-display text-2xl font-extrabold">
          Nhật ký request gần nhất
        </h3>
        <p className="font-semibold text-muted-foreground">
          Các request cùng reference ID, provider, model, nguồn và trạng thái
          được gộp thành một phiên. Không lưu prompt hay API key.
        </p>
      </div>
      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 font-bold text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang tải log...
        </div>
      ) : !analytics?.events.length ? (
        <p className="p-8 text-center font-bold text-muted-foreground">
          Chưa có request nào.
        </p>
      ) : (
        <div className="overflow-x-auto p-4 sm:p-5">
          <table className="w-full min-w-[1140px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Thời gian</th>
                <th className="whitespace-nowrap px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Provider / model</th>
                <th className="whitespace-nowrap px-3 py-2">Nguồn</th>
                <th className="px-3 py-2 text-right">Requests</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">
                  Token
                </th>
                <th className="px-3 py-2 text-right">Chi phí</th>
                <th className="px-3 py-2 text-right">Latency</th>
                <th className="px-3 py-2">Chi tiết lỗi</th>
              </tr>
            </thead>
            <tbody>
              {analytics.events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-divider font-semibold"
                >
                  <td className="whitespace-nowrap px-3 py-3">
                    {new Date(event.createdAt).toLocaleString("vi-VN")}
                    {event.requestCount > 1 ? (
                      <small className="block text-muted-foreground">
                        {new Date(event.startedAt).toLocaleTimeString("vi-VN")}{" "}
                        –{" "}
                        {new Date(event.createdAt).toLocaleTimeString("vi-VN")}
                      </small>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <StatusBadge status={event.status} />
                  </td>
                  <td className="max-w-[260px] px-3 py-3">
                    <strong className="block truncate">
                      {event.providerName}
                    </strong>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {event.model}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {sourceLabels[event.source]}
                  </td>
                  <td className="px-3 py-3 text-right font-extrabold tabular-nums">
                    {formatNumber(event.requestCount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium tabular-nums">
                    {formatNumber(event.inputTokens)} /{" "}
                    {formatNumber(event.outputTokens)}
                    {event.cacheInputTokens ? (
                      <small className="ml-1 text-muted-foreground">
                        (cache {formatNumber(event.cacheInputTokens)})
                      </small>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {event.costUsd == null ? "--" : formatUsd(event.costUsd)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {event.latencyMs == null ? "--" : `${event.latencyMs} ms`}
                  </td>
                  <td className="max-w-[320px] px-3 py-3">
                    <span
                      className="block truncate"
                      title={event.errorMessage ?? ""}
                    >
                      {event.errorMessage ?? event.finishReason ?? "--"}
                    </span>
                    {event.httpStatus ? (
                      <small className="text-muted-foreground">
                        HTTP {event.httpStatus} · {event.errorCode ?? "no-code"}
                      </small>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && analytics ? (
        <Pagination
          {...analytics.eventPagination}
          itemLabel="phiên AI"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </section>
  );
}

function BudgetPanel({
  analytics,
  providers,
  accessToken,
  onChanged,
}: {
  analytics: AiUsageAnalytics | null;
  providers: AiProvider[];
  accessToken: string | null;
  onChanged: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [budgetPage, setBudgetPage] = useState(1);
  const [budgetPageSize, setBudgetPageSize] = useState(3);
  const [form, setForm] = useState<UpsertAiUsageBudgetRequest>({
    name: "Ngân sách AI tháng",
    scope: "global",
    scopeValue: null,
    period: "monthly",
    limitUsd: 10,
    warningPercent: 80,
    isActive: true,
  });
  const budgets = analytics?.budgets ?? [];
  const paginatedBudgets = paginateItems(budgets, budgetPage, budgetPageSize);
  return (
    <div className="rounded-2xl border-2 border-foreground bg-surface p-4 shadow-brutal-md sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-extrabold">Ngân sách</h3>
          <p className="font-semibold text-muted-foreground">
            Cảnh báo theo ngày hoặc tháng
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm ${buttonFocus}`}
          aria-label={showForm ? "Đóng biểu mẫu" : "Thêm ngân sách"}
        >
          {showForm ? (
            <XCircle className="h-5 w-5" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </button>
      </div>
      {showForm ? (
        <form
          className="mt-4 space-y-3 rounded-xl border-2 border-foreground bg-background p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!accessToken) return;
            setSaving(true);
            try {
              await adminCreateAiUsageBudget(form, accessToken);
              setShowForm(false);
              await onChanged();
            } finally {
              setSaving(false);
            }
          }}
        >
          <input
            required
            minLength={2}
            maxLength={120}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            aria-label="Tên ngân sách"
            className={`${controlClass} w-full`}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.scope}
              onChange={(event) => {
                const scope = event.target.value as AiUsageBudgetScope;
                setForm({
                  ...form,
                  scope,
                  scopeValue:
                    scope === "global"
                      ? null
                      : scope === "provider"
                        ? (providers[0]?.id ?? "")
                        : scope === "source"
                          ? "quiz_generation"
                          : "",
                });
              }}
              aria-label="Phạm vi ngân sách"
              className={`${controlClass} w-full`}
            >
              <option value="global">Toàn hệ thống</option>
              <option value="provider">Provider</option>
              <option value="model">Model</option>
              <option value="source">Nguồn gọi</option>
            </select>
            <select
              value={form.period}
              onChange={(event) =>
                setForm({
                  ...form,
                  period: event.target.value as AiUsageBudgetPeriod,
                })
              }
              aria-label="Chu kỳ ngân sách"
              className={`${controlClass} w-full`}
            >
              <option value="daily">Theo ngày</option>
              <option value="monthly">Theo tháng</option>
            </select>
          </div>
          {form.scope === "provider" ? (
            <select
              required
              value={form.scopeValue ?? ""}
              onChange={(event) =>
                setForm({ ...form, scopeValue: event.target.value })
              }
              aria-label="Provider áp dụng"
              className={`${controlClass} w-full`}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          ) : form.scope === "source" ? (
            <select
              required
              value={form.scopeValue ?? ""}
              onChange={(event) =>
                setForm({ ...form, scopeValue: event.target.value })
              }
              aria-label="Nguồn gọi áp dụng"
              className={`${controlClass} w-full`}
            >
              {Object.entries(sourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : form.scope === "model" ? (
            <input
              required
              value={form.scopeValue ?? ""}
              onChange={(event) =>
                setForm({ ...form, scopeValue: event.target.value })
              }
              placeholder="Tên model chính xác"
              aria-label="Model áp dụng"
              className={`${controlClass} w-full`}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-extrabold">
              Giới hạn USD
              <input
                required
                type="number"
                min="0.0001"
                step="0.0001"
                value={form.limitUsd}
                onChange={(event) =>
                  setForm({ ...form, limitUsd: Number(event.target.value) })
                }
                className={`${controlClass} mt-1 w-full`}
              />
            </label>
            <label className="text-xs font-extrabold">
              Cảnh báo %
              <input
                required
                type="number"
                min="1"
                max="100"
                value={form.warningPercent}
                onChange={(event) =>
                  setForm({
                    ...form,
                    warningPercent: Number(event.target.value),
                  })
                }
                className={`${controlClass} mt-1 w-full`}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`min-h-10 w-full cursor-pointer rounded-xl border-2 border-foreground bg-primary font-extrabold disabled:opacity-50 ${buttonFocus}`}
          >
            {saving ? "Đang lưu..." : "Tạo ngân sách"}
          </button>
        </form>
      ) : null}
      <div className="mt-4 space-y-3">
        {!budgets.length ? (
          <div className="rounded-xl border-2 border-dashed border-divider p-5 text-center font-bold text-muted-foreground">
            Chưa đặt ngân sách. Hãy tạo giới hạn để kiểm soát chi phí.
          </div>
        ) : (
          paginatedBudgets.items.map((budget) => (
            <div
              key={budget.id}
              className={`rounded-xl border-2 border-foreground p-3 ${budget.state === "exceeded" ? "bg-destructive-soft" : budget.state === "warning" ? "bg-warning-soft" : "bg-success-soft"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{budget.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {budget.period === "daily" ? "Hôm nay" : "Tháng này"} ·{" "}
                    {budget.scope}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={
                      budget.isActive ? "Tắt ngân sách" : "Bật ngân sách"
                    }
                    onClick={async () => {
                      if (!accessToken) return;
                      await adminUpdateAiUsageBudget(
                        budget.id,
                        { isActive: !budget.isActive },
                        accessToken,
                      );
                      await onChanged();
                    }}
                    className={`rounded-lg border-2 border-foreground px-2 py-1 text-xs font-extrabold ${budget.isActive ? "bg-success" : "bg-surface"}`}
                  >
                    {budget.isActive ? "Bật" : "Tắt"}
                  </button>
                  <button
                    type="button"
                    aria-label="Xóa ngân sách"
                    onClick={async () => {
                      if (!accessToken || !window.confirm("Xóa ngân sách này?"))
                        return;
                      await adminDeleteAiUsageBudget(budget.id, accessToken);
                      await onChanged();
                    }}
                    className="rounded-lg p-1.5 hover:bg-destructive-soft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full border-2 border-foreground bg-surface">
                <div
                  className={`h-full ${budget.state === "exceeded" ? "bg-destructive" : budget.state === "warning" ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${Math.min(100, budget.usagePercent)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-sm font-extrabold tabular-nums">
                <span>{formatUsd(budget.spentUsd)}</span>
                <span>
                  {budget.usagePercent.toFixed(1)}% /{" "}
                  {formatUsd(budget.limitUsd)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      {budgets.length ? (
        <div className="-mx-4 -mb-4 mt-4 overflow-hidden rounded-b-[14px] sm:-mx-5 sm:-mb-5">
          <Pagination
            {...paginatedBudgets.pagination}
            itemLabel="ngân sách"
            pageSizeOptions={[3, 6, 12]}
            onPageChange={setBudgetPage}
            onPageSizeChange={(pageSize) => {
              setBudgetPageSize(pageSize);
              setBudgetPage(1);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: AiUsageStatus }) {
  const classes =
    status === "success"
      ? "bg-success-soft"
      : status === "timeout"
        ? "bg-warning-soft"
        : "bg-destructive-soft";
  return (
    <span
      className={`inline-flex whitespace-nowrap items-center gap-1 rounded-full border-2 border-foreground px-2 py-0.5 text-xs font-extrabold ${classes}`}
    >
      {status === "success" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : status === "timeout" ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {statusLabels[status]}
    </span>
  );
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function comparison(
  current: number | undefined,
  previous: number | undefined,
  suffix: string,
): string {
  if (!previous) return `Chưa có dữ liệu ${suffix}`;
  const change = (((current ?? 0) - previous) / previous) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}% so với ${suffix}`;
}

function granularityLabel(value?: "hour" | "day" | "month") {
  if (value === "hour") return "giờ";
  if (value === "month") return "tháng";
  return "ngày";
}
