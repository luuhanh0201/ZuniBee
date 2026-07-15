"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleDollarSign, Loader2, Search, WalletCards } from "lucide-react";
import type { AiCreditAdminUser, AiCreditAdminUserPage } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import {
  adminGrantAiCredit,
  adminSearchCreditUsers,
} from "@/components/ai/ai-api";
import { MetricCard, formatNumber } from "@/components/ai/metric-card";
import { Pagination } from "@/components/admin/pagination";

const control =
  "min-h-11 rounded-xl border-2 border-foreground bg-background px-3 font-bold outline-none focus:ring-2 focus:ring-ring";

export function AdminCreditPage() {
  const { accessToken } = useAuth();
  const [result, setResult] = useState<AiCreditAdminUserPage>(EMPTY_RESULT);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AiCreditAdminUser | null>(null);
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(
    async (search = "", page = 1, pageSize = 20) => {
      if (!accessToken) return;
      setLoading(true);
      try {
        setResult(
          await adminSearchCreditUsers(search, { page, pageSize }, accessToken),
        );
        setMessage("");
      } catch (cause) {
        setMessage(
          cause instanceof Error ? cause.message : "Không tải được AI Credit",
        );
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    adminSearchCreditUsers("", { page: 1, pageSize: 20 }, accessToken)
      .then((response) => {
        if (!active) return;
        setResult(response);
        setMessage("");
      })
      .catch((cause: unknown) => {
        if (active)
          setMessage(
            cause instanceof Error ? cause.message : "Không tải được AI Credit",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const users = result.items;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Credit ledger
        </p>
        <h2 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
          Quản lý AI Credit
        </h2>
        <p className="mt-2 font-semibold text-muted-foreground">
          Số dư đọc trực tiếp từ ví người dùng. Mỗi lần cấp credit tạo một bút
          toán có người thực hiện và ghi chú.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={WalletCards}
          label="Tổng người dùng"
          value={formatNumber(result.pagination.total)}
          helper={appliedQuery ? "Theo kết quả tìm kiếm" : "Có ví AI Credit"}
          color="bg-secondary-soft"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Tổng số dư"
          value={formatNumber(result.totals.balance)}
          helper="Trong toàn bộ kết quả"
          color="bg-primary"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Đang giữ chỗ"
          value={formatNumber(result.totals.reserved)}
          helper="Credit dành cho tác vụ đang chạy"
          color="bg-warning-soft"
        />
      </section>

      <section className="rounded-2xl border-2 border-foreground bg-surface shadow-brutal-md">
        <form
          className="flex flex-col gap-3 border-b-2 border-foreground p-4 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedQuery(query.trim());
            void load(query.trim(), 1, result.pagination.pageSize);
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên hoặc email"
              aria-label="Tìm người dùng"
              className={`${control} w-full pl-10`}
            />
          </div>
          <button className="min-h-11 rounded-xl border-2 border-foreground bg-primary px-5 font-extrabold shadow-brutal-sm">
            Tìm kiếm
          </button>
        </form>
        {message ? (
          <p className="m-4 rounded-xl border-2 border-destructive bg-destructive-soft p-3 font-bold">
            {message}
          </p>
        ) : null}
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 font-bold text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Đang tải ví...
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b-2 border-foreground text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Người dùng</th>
                  <th className="px-3 py-2">Vai trò</th>
                  <th className="px-3 py-2 text-right">Số dư</th>
                  <th className="px-3 py-2 text-right">Giữ chỗ</th>
                  <th className="px-3 py-2 text-right">Khả dụng</th>
                  <th className="px-3 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-divider font-semibold"
                  >
                    <td className="px-3 py-3">
                      <strong className="block">{user.fullName}</strong>
                      <small className="text-muted-foreground">
                        {user.email ?? "Chưa có email"}
                      </small>
                    </td>
                    <td className="px-3 py-3">{user.role}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatNumber(user.credit.balance)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatNumber(user.credit.reserved)}
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold tabular-nums">
                      {formatNumber(user.credit.available)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(user)}
                        className="rounded-xl border-2 border-foreground bg-success-soft px-3 py-2 font-extrabold hover:shadow-brutal-sm"
                      >
                        Cấp credit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading ? (
          <Pagination
            {...result.pagination}
            itemLabel="người dùng"
            onPageChange={(page) =>
              void load(appliedQuery, page, result.pagination.pageSize)
            }
            onPageSizeChange={(pageSize) =>
              void load(appliedQuery, 1, pageSize)
            }
          />
        ) : null}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-4">
          <form
            className="w-full max-w-md rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-lg"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!accessToken) return;
              setSaving(true);
              try {
                await adminGrantAiCredit(
                  { userId: selected.id, amount, note: note || undefined },
                  accessToken,
                );
                setSelected(null);
                setNote("");
                await load(
                  appliedQuery,
                  result.pagination.page,
                  result.pagination.pageSize,
                );
              } catch (cause) {
                setMessage(
                  cause instanceof Error
                    ? cause.message
                    : "Không thể cấp credit",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <h3 className="font-display text-2xl font-extrabold">
              Cấp AI Credit
            </h3>
            <p className="mt-1 font-semibold text-muted-foreground">
              {selected.fullName} · hiện có{" "}
              {formatNumber(selected.credit.balance)}
            </p>
            <label className="mt-4 block font-extrabold">
              Số credit
              <input
                type="number"
                min={1}
                max={1_000_000}
                required
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
                className={`${control} mt-2 w-full`}
              />
            </label>
            <label className="mt-3 block font-extrabold">
              Ghi chú kiểm toán
              <textarea
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={`${control} mt-2 min-h-24 w-full py-3`}
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="min-h-11 rounded-xl border-2 border-foreground px-4 font-extrabold"
              >
                Hủy
              </button>
              <button
                disabled={saving}
                className="min-h-11 rounded-xl border-2 border-foreground bg-primary px-4 font-extrabold disabled:opacity-50"
              >
                {saving ? "Đang cấp..." : "Xác nhận cấp"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY_RESULT: AiCreditAdminUserPage = {
  items: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  totals: { balance: 0, reserved: 0, available: 0 },
  roleCounts: { student: 0, teacher: 0, admin: 0 },
};
