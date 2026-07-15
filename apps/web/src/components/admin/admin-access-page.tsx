"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { adminSearchCreditUsers } from "@/components/ai/ai-api";
import { MetricCard, formatNumber } from "@/components/ai/metric-card";
import { RoleBadge } from "./admin-users-page";

const permissions = [
  ["Làm quiz được giao", true, true, true],
  ["Tạo lớp học và quiz", false, true, true],
  ["Dùng công cụ AI", true, true, true],
  ["Quản lý AI Provider", false, false, true],
  ["Cấp AI Credit", false, false, true],
  ["Xem usage toàn hệ thống", false, false, true],
] as const;

export function AdminAccessPage() {
  const { accessToken } = useAuth();
  const [counts, setCounts] = useState({ student: 0, teacher: 0, admin: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!accessToken) return;
    adminSearchCreditUsers("", { page: 1, pageSize: 100 }, accessToken)
      .then((result) => setCounts(result.roleCounts))
      .finally(() => setLoading(false));
  }, [accessToken]);
  return (
    <div className="space-y-6">
      <div>
        <p className="font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Role based access
        </p>
        <h2 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
          Phân quyền
        </h2>
        <p className="mt-2 font-semibold text-muted-foreground">
          Ma trận quyền đang áp dụng bởi backend RolesGuard; thống kê tài khoản
          lấy từ dữ liệu thật.
        </p>
      </div>
      {loading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 font-bold text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang đọc vai trò...
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            icon={Users}
            label="Học sinh"
            value={formatNumber(counts.student ?? 0)}
            helper="Toàn bộ hệ thống"
            color="bg-success-soft"
          />
          <MetricCard
            icon={Users}
            label="Giáo viên"
            value={formatNumber(counts.teacher ?? 0)}
            helper="Toàn bộ hệ thống"
            color="bg-secondary-soft"
          />
          <MetricCard
            icon={ShieldCheck}
            label="Quản trị"
            value={formatNumber(counts.admin ?? 0)}
            helper="Toàn bộ hệ thống"
            color="bg-primary"
          />
        </section>
      )}
      <section className="rounded-2xl border-2 border-foreground bg-surface shadow-brutal-md">
        <div className="border-b-2 border-foreground p-5">
          <h3 className="font-display text-2xl font-extrabold">
            Ma trận quyền hiện hành
          </h3>
          <p className="font-semibold text-muted-foreground">
            Trang này phản ánh chính sách hiện tại; thay đổi vai trò cần đi qua
            luồng quản trị có audit riêng.
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[650px] text-left">
            <thead>
              <tr className="border-b-2 border-foreground text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">Khả năng</th>
                <th className="px-3 py-3 text-center">
                  <RoleBadge role="student" />
                </th>
                <th className="px-3 py-3 text-center">
                  <RoleBadge role="teacher" />
                </th>
                <th className="px-3 py-3 text-center">
                  <RoleBadge role="admin" />
                </th>
              </tr>
            </thead>
            <tbody>
              {permissions.map(([label, student, teacher, admin]) => (
                <tr key={label} className="border-b border-divider font-bold">
                  <td className="px-3 py-3">{label}</td>
                  {[student, teacher, admin].map((allowed, index) => (
                    <td key={index} className="px-3 py-3 text-center">
                      {allowed ? (
                        <Check
                          className="mx-auto h-5 w-5 text-success"
                          aria-label="Có quyền"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
