"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CircleDollarSign,
  CloudCog,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/lib/auth-context";

const buttonFocus =
  "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring";

const navigation = [
  { href: ROUTES.adminOverview, label: "Tổng quan", icon: LayoutDashboard },
  { href: ROUTES.adminAiProviders, label: "AI Providers", icon: CloudCog },
  { href: ROUTES.adminAiUsage, label: "Thống kê AI", icon: BarChart3 },
  { href: ROUTES.adminAiCredits, label: "AI Credit", icon: CircleDollarSign },
  { href: ROUTES.adminUsers, label: "Người dùng", icon: Users },
  { href: ROUTES.adminAccess, label: "Phân quyền", icon: ShieldCheck },
  { href: ROUTES.adminSettings, label: "Cài đặt", icon: Settings2 },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  return href === ROUTES.adminOverview
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current =
    navigation.find((item) => isActivePath(pathname, item.href)) ??
    navigation[0];

  return (
    <RequireRole role={UserRole.ADMIN} allowDemo={false}>
      <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        {mobileOpen ? (
          <button
            type="button"
            aria-label="Đóng menu quản trị"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 cursor-default bg-foreground/40 lg:hidden"
          />
        ) : null}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r-2 border-foreground bg-surface transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex min-h-20 items-center justify-between border-b-2 border-foreground px-5">
            <Link
              href={ROUTES.home}
              className={`flex cursor-pointer items-center gap-3 rounded-lg ${buttonFocus}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <strong className="block font-display text-xl">ZuniBee</strong>
                <small className="font-extrabold uppercase tracking-wider text-muted-foreground">
                  Admin
                </small>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Đóng menu"
              className={`cursor-pointer rounded-lg p-2 hover:bg-surface-soft lg:hidden ${buttonFocus}`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <nav
            aria-label="Điều hướng quản trị"
            className="flex-1 space-y-1 p-4"
          >
            <p className="px-3 pb-2 pt-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
              Workspace
            </p>
            {navigation.map(({ href, icon: Icon, label }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-3 text-left font-bold transition-colors duration-200 ${active ? "border-foreground bg-primary shadow-brutal-sm" : "border-transparent hover:bg-surface-soft"} ${buttonFocus}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t-2 border-foreground p-4">
            <div className="rounded-2xl border-2 border-foreground bg-secondary-soft p-4 shadow-brutal-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-surface font-extrabold">
                  {initials(user?.fullName ?? "Admin")}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-extrabold">
                    {user?.fullName ?? "Admin"}
                  </p>
                  <p className="truncate text-xs font-bold text-muted-foreground">
                    {user?.email ?? "Quản trị viên"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className={`mt-3 flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-3 font-bold transition-colors hover:bg-warning-soft ${buttonFocus}`}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Đăng xuất
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-4 border-b-2 border-foreground bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Mở menu quản trị"
                className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm lg:hidden ${buttonFocus}`}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                  Quản trị hệ thống
                </p>
                <h1 className="font-display text-xl font-extrabold sm:text-2xl">
                  {current.label}
                </h1>
              </div>
            </div>
            <span className="hidden rounded-full border-2 border-foreground bg-success-soft px-3 py-1.5 text-sm font-extrabold sm:inline-flex sm:items-center sm:gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-success" />
              Dữ liệu hệ thống
            </span>
          </header>
          <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
            {children}
          </main>
        </div>
      </div>
    </RequireRole>
  );
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AD"
  );
}
