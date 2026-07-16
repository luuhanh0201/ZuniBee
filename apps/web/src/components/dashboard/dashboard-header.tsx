"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  BookOpenCheck,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Library,
  LogOut,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/lib/auth-context";
import { BrandLockup } from "@/components/ui/brand-lockup";

export type DashboardRole = UserRole.STUDENT | UserRole.TEACHER;

export function DashboardHeader({ role }: { role: DashboardRole }) {
  const student = role === UserRole.STUDENT;
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await logout();
    router.push(ROUTES.login);
  }

  const navItems: Array<{
    icon: LucideIcon;
    label: string;
    href: string;
  }> = [
    {
      icon: LayoutDashboard,
      label: student ? "Hôm nay" : "Tổng quan",
      href: student ? ROUTES.studentDashboard : ROUTES.teacherDashboard,
    },
    {
      icon: student ? BookOpen : Users,
      label: "Lớp học",
      href: student ? ROUTES.studentClasses : ROUTES.teacherClasses,
    },
    {
      icon: student ? BookOpenCheck : Library,
      label: student ? "Hoạt động" : "Nội dung",
      href: student ? ROUTES.studentQuizzes : ROUTES.teacherQuizzes,
    },
  ];

  const isActive = (href: string) =>
    pathname === href ||
    (href !== ROUTES.studentDashboard &&
      href !== ROUTES.teacherDashboard &&
      pathname.startsWith(`${href}/`));

  return (
    <header className="border-b border-divider bg-surface px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 py-2.5">
        <BrandLockup className="shrink-0" />

        <nav
          aria-label="Điều hướng không gian làm việc"
          className="hidden items-center gap-1 rounded-2xl bg-surface-soft p-1 md:flex"
        >
          {navItems.map(({ icon: NavIcon, label, href }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ${isActive(href) ? "bg-surface text-foreground shadow-brutal-xs" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}
            >
              <NavIcon aria-hidden="true" className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={ROUTES.profile}
            aria-label="Hồ sơ cá nhân"
            title="Hồ sơ cá nhân"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-divider bg-surface text-muted-foreground transition-[border-color,color,background-color] duration-200 hover:border-foreground/40 hover:bg-surface-soft hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <UserRound aria-hidden="true" className="h-5 w-5" />
          </Link>
          <Link
            href={ROUTES.changePassword}
            aria-label="Đổi mật khẩu"
            title="Đổi mật khẩu"
            className="hidden h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-divider bg-surface text-muted-foreground transition-[border-color,color,background-color] duration-200 hover:border-foreground/40 hover:bg-surface-soft hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex"
          >
            <KeyRound aria-hidden="true" className="h-5 w-5" />
          </Link>
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-divider bg-surface px-3 font-semibold text-muted-foreground transition-[border-color,color,background-color] duration-200 hover:border-foreground/40 hover:bg-surface-soft hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <LogOut aria-hidden="true" className="h-5 w-5" />
              <span className="hidden lg:inline">Đăng xuất</span>
            </button>
          ) : (
            <Link
              href={ROUTES.onboarding}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-divider bg-surface px-3 font-semibold text-muted-foreground transition-[border-color,color,background-color] duration-200 hover:border-foreground/40 hover:bg-surface-soft hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {student ? (
                <BookOpen aria-hidden="true" className="h-5 w-5" />
              ) : (
                <GraduationCap aria-hidden="true" className="h-5 w-5" />
              )}
              <span className="hidden sm:inline">Đổi vai trò</span>
            </Link>
          )}
        </div>
      </div>

      <nav
        aria-label="Điều hướng không gian làm việc trên thiết bị nhỏ"
        className="mx-auto flex max-w-7xl gap-1 overflow-x-auto border-t border-divider py-2 md:hidden"
      >
        {navItems.map(({ icon: NavIcon, label, href }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ${isActive(href) ? "bg-primary text-on-primary" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"}`}
          >
            <NavIcon aria-hidden="true" className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
