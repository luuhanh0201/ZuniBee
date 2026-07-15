"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  CloudCog,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { AiProvider, AiUsageBudget } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/config/routes";
import {
  adminListAiProviders,
  adminListAiUsageBudgets,
} from "@/components/ai/ai-api";

export function AdminSettingsPage() {
  const { accessToken } = useAuth();
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [budgets, setBudgets] = useState<AiUsageBudget[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      adminListAiProviders(accessToken),
      adminListAiUsageBudgets(accessToken),
    ])
      .then(([providerRows, budgetRows]) => {
        setProviders(providerRows);
        setBudgets(budgetRows);
      })
      .finally(() => setLoading(false));
  }, [accessToken]);
  return (
    <div className="space-y-6">
      <div>
        <p className="font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          System configuration
        </p>
        <h2 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
          Cài đặt quản trị
        </h2>
        <p className="mt-2 font-semibold text-muted-foreground">
          Tổng hợp cấu hình vận hành đang lưu; mỗi nhóm dẫn đến trang quản lý
          nguồn tương ứng.
        </p>
      </div>
      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 font-bold text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang đọc cấu hình...
        </div>
      ) : (
        <section className="grid gap-5 lg:grid-cols-2">
          <SettingCard
            icon={CloudCog}
            title="AI Providers"
            value={`${providers.filter((provider) => provider.isActive).length}/${providers.length} đang bật`}
            detail={`${providers.filter((provider) => provider.isDefault).length} sinh quiz · ${providers.filter((provider) => provider.isVisionDefault).length} đọc ảnh · ${providers.filter((provider) => provider.inputUsdPer1m == null || provider.outputUsdPer1m == null).length} thiếu giá`}
            href={ROUTES.adminAiProviders}
          />
          <SettingCard
            icon={CircleDollarSign}
            title="Ngân sách AI"
            value={`${budgets.filter((budget) => budget.isActive).length}/${budgets.length} đang bật`}
            detail={`${budgets.filter((budget) => budget.state === "warning").length} cảnh báo · ${budgets.filter((budget) => budget.state === "exceeded").length} vượt mức`}
            href={ROUTES.adminAiUsage}
          />
          <SettingCard
            icon={ShieldCheck}
            title="Bảo vệ API"
            value="Đang áp dụng"
            detail="JWT + RolesGuard + CSRF header + CORS allowlist + rate limiting Redis"
            href={ROUTES.adminAccess}
          />
          <SettingCard
            icon={CircleDollarSign}
            title="AI Credit"
            value="Ví tự tạo cho user"
            detail="Cấp phát có ledger; reserve/consume/release theo từng tác vụ"
            href={ROUTES.adminAiCredits}
          />
        </section>
      )}
      <div className="rounded-2xl border border-amber-200/70 bg-warning-soft p-5 shadow-sm">
        <h3 className="text-lg font-bold">Phạm vi cài đặt</h3>
        <p className="mt-2 text-sm font-medium leading-relaxed">
          Các giá trị nhạy cảm như API key chỉ được ghi ở trang Provider và
          backend chỉ trả cờ <code>hasApiKey</code>, không trả secret về trình
          duyệt. Trang này không dựng dữ liệu mẫu.
        </p>
      </div>
    </div>
  );
}

function SettingCard({
  icon: Icon,
  title,
  value,
  detail,
  href,
}: {
  icon: typeof CloudCog;
  title: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-divider bg-surface p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-soft text-secondary-strong">
          <Icon className="h-6 w-6" />
        </span>
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-medium text-muted-foreground">{detail}</p>
    </Link>
  );
}
