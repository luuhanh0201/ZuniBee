"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDollarSign,
  Loader2,
  Zap,
} from "lucide-react";
import type { AiUsageStatRow, AiUsageStats } from "@zunibee/shared";
import { adminGetAiUsageStats } from "./ai-api";
import { MetricCard, formatNumber } from "./metric-card";

const buttonFocus =
  "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonth(): string {
  const date = new Date();
  date.setUTCDate(1);
  return toDateInputValue(date);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

type ProviderGroup = {
  providerId: string;
  providerName: string;
  costUsd: number;
  rows: AiUsageStatRow[];
};

function groupByProvider(rows: AiUsageStatRow[]): ProviderGroup[] {
  const groups = new Map<string, ProviderGroup>();
  for (const row of rows) {
    const group = groups.get(row.providerId) ?? {
      providerId: row.providerId,
      providerName: row.providerName,
      costUsd: 0,
      rows: [],
    };
    group.costUsd += row.costUsd ?? 0;
    group.rows.push(row);
    groups.set(row.providerId, group);
  }
  return [...groups.values()].sort((a, b) => b.costUsd - a.costUsd);
}

export function AdminAiUsageSection({
  accessToken,
}: {
  accessToken: string | null;
}) {
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(() => toDateInputValue(new Date()));
  const [stats, setStats] = useState<AiUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(
    (fromValue: string, toValue: string, token: string) =>
      adminGetAiUsageStats(
        {
          from: new Date(`${fromValue}T00:00:00.000Z`).toISOString(),
          to: new Date(`${toValue}T23:59:59.999Z`).toISOString(),
        },
        token,
      ),
    [],
  );

  // Không set loading synchronous trong hàm này — isLoading khởi tạo true,
  // các nút bấm tự set trước khi gọi (tránh cascading render trong effect).
  const load = useCallback(
    async (fromValue: string, toValue: string) => {
      if (!accessToken) return;
      try {
        setStats(await fetchStats(fromValue, toValue, accessToken));
        setError("");
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể tải thống kê sử dụng AI",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, fetchStats],
  );

  // Chỉ fetch lại khi bấm "Xem" hoặc "Tháng này" — không theo từng phím gõ.
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    fetchStats(firstDayOfMonth(), toDateInputValue(new Date()), accessToken)
      .then((result) => {
        if (!active) return;
        setStats(result);
        setError("");
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải thống kê sử dụng AI",
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, fetchStats]);

  const groups = useMemo(
    () => groupByProvider(stats?.rows ?? []),
    [stats?.rows],
  );
  const totals = stats?.totals;

  return (
    <>
      <section
        aria-label="Bộ lọc thống kê"
        className="flex flex-col gap-3 rounded-2xl border-2 border-foreground bg-surface p-4 shadow-brutal-md sm:flex-row sm:items-end"
      >
        <label className="block font-extrabold">
          Từ ngày
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-2 block min-h-11 w-full rounded-xl border-2 border-foreground bg-background px-3 font-semibold outline-none focus:ring-2 focus:ring-ring sm:w-auto"
          />
        </label>
        <label className="block font-extrabold">
          Đến ngày
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className="mt-2 block min-h-11 w-full rounded-xl border-2 border-foreground bg-background px-3 font-semibold outline-none focus:ring-2 focus:ring-ring sm:w-auto"
          />
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setIsLoading(true);
              void load(from, to);
            }}
            className={`min-h-11 cursor-pointer rounded-xl border-2 border-foreground bg-primary px-5 font-extrabold shadow-brutal-sm transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md disabled:cursor-not-allowed disabled:opacity-50 ${buttonFocus}`}
          >
            Xem
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              const start = firstDayOfMonth();
              const end = toDateInputValue(new Date());
              setFrom(start);
              setTo(end);
              setIsLoading(true);
              void load(start, end);
            }}
            className={`min-h-11 cursor-pointer rounded-xl border-2 border-foreground bg-surface px-4 font-extrabold transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50 ${buttonFocus}`}
          >
            Tháng này
          </button>
        </div>
      </section>

      <section
        aria-label="Tổng quan sử dụng AI"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          icon={Zap}
          label="Tổng request"
          value={formatNumber(totals?.requests ?? 0)}
          helper="Số lần gọi AI thành công"
          color="bg-secondary-soft"
        />
        <MetricCard
          icon={ArrowDownToLine}
          label="Input tokens"
          value={formatNumber(totals?.inputTokens ?? 0)}
          helper="Token gửi lên provider"
          color="bg-success-soft"
        />
        <MetricCard
          icon={ArrowUpFromLine}
          label="Output tokens"
          value={formatNumber(totals?.outputTokens ?? 0)}
          helper="Token provider sinh ra"
          color="bg-warning-soft"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Tổng chi phí"
          value={formatUsd(totals?.costUsd ?? 0)}
          helper={
            totals?.unpricedRequests
              ? `${formatNumber(totals.unpricedRequests)} request thiếu giá`
              : "Theo đơn giá tại thời điểm gọi"
          }
          color="bg-primary"
        />
      </section>

      <section className="mt-6 rounded-2xl border-2 border-foreground bg-surface shadow-brutal-md">
        <div className="border-b-2 border-foreground p-4 sm:p-5">
          <h2 className="font-display text-2xl font-extrabold">
            Chi tiết theo provider / model
          </h2>
          <p className="mt-1 font-semibold text-muted-foreground">
            Token và chi phí snapshot theo đơn giá tại thời điểm gọi. Thống kê
            tính từ khi bật tính năng, không gồm dữ liệu trước đó.
          </p>
        </div>
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-3 font-bold text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            Đang tải thống kê...
          </div>
        ) : error ? (
          <div className="m-4 rounded-xl border-2 border-destructive bg-destructive-soft p-6 text-center font-extrabold">
            {error}
          </div>
        ) : !groups.length ? (
          <p className="p-8 text-center font-bold text-muted-foreground">
            Chưa có lượt gọi AI nào trong khoảng thời gian này.
          </p>
        ) : (
          <div className="overflow-x-auto p-4 sm:p-5">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-foreground text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2 text-right">Requests</th>
                  <th className="px-3 py-2 text-right">Input tokens</th>
                  <th className="px-3 py-2 text-right">Output tokens</th>
                  <th className="px-3 py-2 text-right">Chi phí (USD)</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.providerId}>
                  <tr className="border-b border-divider bg-surface-soft">
                    <th
                      colSpan={4}
                      className="px-3 py-2 font-display text-base font-extrabold"
                    >
                      {group.providerName}
                    </th>
                    <td className="px-3 py-2 text-right font-extrabold tabular-nums">
                      {formatUsd(group.costUsd)}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr
                      key={`${row.providerId}:${row.model}`}
                      className="border-b border-divider font-semibold"
                    >
                      <td className="px-3 py-2.5 font-mono text-sm">
                        {row.model}
                        {row.costUsd === null || row.unpricedRequests > 0 ? (
                          <span className="ml-2 inline-flex rounded-full border-2 border-foreground bg-warning-soft px-2 py-0.5 text-xs font-extrabold">
                            thiếu giá
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatNumber(row.requests)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatNumber(row.inputTokens)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatNumber(row.outputTokens)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.costUsd === null ? "--" : formatUsd(row.costUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </section>
    </>
  );
}
