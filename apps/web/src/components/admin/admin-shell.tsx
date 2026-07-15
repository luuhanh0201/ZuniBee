"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronDown,
  CircleDollarSign,
  CloudCog,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
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

const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const navigation = [
  { href: ROUTES.adminOverview, label: "Tổng quan", icon: LayoutDashboard },
  { href: ROUTES.adminUsers, label: "Người dùng", icon: Users },
  { href: ROUTES.adminAiProviders, label: "AI Providers", icon: CloudCog },
  { href: ROUTES.adminAiUsage, label: "Thống kê AI", icon: BarChart3 },
  { href: ROUTES.adminAiCredits, label: "AI Credit", icon: CircleDollarSign },
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
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const current =
    navigation.find((item) => isActivePath(pathname, item.href)) ??
    navigation[0];
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    if (!normalized) return navigation;
    return navigation.filter((item) =>
      item.label.toLocaleLowerCase("vi").includes(normalized),
    );
  }, [query]);

  return (
    <RequireRole role={UserRole.ADMIN} allowDemo={false}>
      <div
        className={`min-h-dvh bg-background text-foreground transition-[grid-template-columns] duration-200 motion-reduce:transition-none lg:grid ${collapsed ? "lg:grid-cols-[84px_minmax(0,1fr)]" : "lg:grid-cols-[264px_minmax(0,1fr)]"}`}
      >
        {mobileOpen ? (
          <button
            type="button"
            aria-label="Đóng menu quản trị"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 cursor-pointer bg-slate-950/35 backdrop-blur-[2px] lg:hidden"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-divider bg-surface shadow-[8px_0_30px_rgb(15_23_42/0.05)] transition-[width,transform] duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:shadow-none ${collapsed ? "lg:w-[84px]" : "lg:w-[264px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex min-h-20 items-center gap-3 border-b border-divider px-4">
            <Link
              href={ROUTES.adminOverview}
              aria-label="ZuniBee Admin"
              className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl ${focusClass}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
                <strong className="block truncate text-lg font-bold tracking-tight">
                  ZuniBee
                </strong>
                <small className="block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Admin Console
                </small>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Đóng menu"
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-soft hover:text-foreground lg:hidden ${focusClass}`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Điều hướng quản trị" className="flex-1 p-3">
            <p
              className={`px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground ${collapsed ? "lg:hidden" : ""}`}
            >
              Quản trị hệ thống
            </p>
            {collapsed ? (
              <span className="hidden h-4 lg:block" aria-hidden="true" />
            ) : null}
            <div className="space-y-1">
              {navigation.map(({ href, icon: Icon, label }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-200 ${collapsed ? "lg:justify-center lg:px-2" : ""} ${active ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-secondary-soft hover:text-foreground"} ${focusClass}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className={collapsed ? "lg:hidden" : undefined}>
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-divider p-3">
            <div
              className={`rounded-2xl border border-divider bg-surface-soft p-3 ${collapsed ? "lg:hidden" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-sm font-bold text-secondary-strong">
                  {initials(user?.fullName ?? "Admin")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {user?.fullName ?? "Admin"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.email ?? "Quản trị viên"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className={`mt-3 flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-divider bg-surface px-3 text-sm font-semibold transition-colors hover:border-destructive/30 hover:bg-destructive-soft hover:text-destructive ${focusClass}`}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Đăng xuất
              </button>
            </div>
            {collapsed ? (
              <button
                type="button"
                title="Đăng xuất"
                aria-label="Đăng xuất"
                onClick={() => void logout()}
                className={`hidden h-11 w-full cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive lg:flex ${focusClass}`}
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
              className={`mt-2 hidden h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-soft hover:text-foreground lg:flex ${focusClass}`}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
              ) : (
                <>
                  <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
                  Thu gọn
                </>
              )}
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-divider bg-surface/95 backdrop-blur-md">
            <div className="flex min-h-20 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Mở menu quản trị"
                className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-divider bg-surface text-muted-foreground shadow-sm transition-colors hover:bg-surface-soft hover:text-foreground lg:hidden ${focusClass}`}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="min-w-0 flex-1">
                <nav
                  aria-label="Breadcrumb"
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
                >
                  <Link
                    href={ROUTES.adminOverview}
                    className={`cursor-pointer rounded hover:text-primary ${focusClass}`}
                  >
                    Admin
                  </Link>
                  <span aria-hidden="true">/</span>
                  <span aria-current="page" className="truncate">
                    {current.label}
                  </span>
                </nav>
                <h1 className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {current.label}
                </h1>
              </div>

              <div className="relative hidden w-full max-w-sm md:block">
                <label htmlFor="admin-navigation-search" className="sr-only">
                  Tìm trang quản trị
                </label>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="admin-navigation-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() =>
                    window.setTimeout(() => setSearchFocused(false), 120)
                  }
                  placeholder="Tìm trang quản trị..."
                  autoComplete="off"
                  className={`min-h-11 w-full rounded-xl border border-divider bg-surface-soft py-2 pl-10 pr-3 text-sm font-medium outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-surface focus:ring-2 focus:ring-ring/20 ${focusClass}`}
                />
                {searchFocused && query.trim() ? (
                  <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border border-divider bg-surface p-1.5 shadow-lg">
                    {searchResults.length ? (
                      searchResults.map(({ href, icon: Icon, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setQuery("")}
                          className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors hover:bg-secondary-soft ${focusClass}`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {label}
                        </Link>
                      ))
                    ) : (
                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                        Không tìm thấy trang phù hợp
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <Link
                href={ROUTES.adminOverview}
                aria-label="Xem cảnh báo hệ thống"
                title="Cảnh báo hệ thống"
                className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-divider bg-surface text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-secondary-soft hover:text-primary ${focusClass}`}
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
              </Link>

              <details className="group relative">
                <summary
                  className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-divider bg-surface px-2 shadow-sm transition-colors hover:bg-surface-soft [&::-webkit-details-marker]:hidden ${focusClass}`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-soft text-xs font-bold text-secondary-strong">
                    {initials(user?.fullName ?? "Admin")}
                  </span>
                  <span className="hidden max-w-32 truncate text-sm font-semibold xl:block">
                    {user?.fullName ?? "Admin"}
                  </span>
                  <ChevronDown
                    className="hidden h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 sm:block"
                    aria-hidden="true"
                  />
                </summary>
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-64 rounded-xl border border-divider bg-surface p-2 shadow-lg">
                  <div className="border-b border-divider px-3 py-2">
                    <p className="truncate text-sm font-semibold">
                      {user?.fullName ?? "Admin"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email ?? "Quản trị viên"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className={`mt-1 flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive-soft ${focusClass}`}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Đăng xuất
                  </button>
                </div>
              </details>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
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
