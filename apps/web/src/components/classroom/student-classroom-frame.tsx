"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  LayoutDashboard,
  Sparkles,
  UserRound,
} from "lucide-react";

export function StudentClassroomFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navItems = [
    { href: "/student", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/student/classes", label: "Lớp học", icon: BookOpen },
    { href: "/student/quizzes", label: "Quiz", icon: BookOpenCheck },
  ];
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b-2 border-foreground bg-surface px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link
            href="/"
            className="flex cursor-pointer items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="hidden font-display text-xl font-bold sm:inline">
              ZuniBee
            </span>
          </Link>

          <nav
            aria-label="Điều hướng học sinh"
            className="flex items-center gap-2"
          >
            {navItems.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/student" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4 ${active ? "border-2 border-foreground bg-primary shadow-brutal-sm" : "text-muted-foreground hover:bg-surface-soft hover:text-foreground"}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span
                    className={label === "Tổng quan" ? "hidden sm:inline" : ""}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
            <Link
              href="/profile"
              aria-label="Hồ sơ cá nhân"
              title="Hồ sơ cá nhân"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export function StudentClassroomPageHeader({
  title,
  description,
  backHref = "/student",
  backLabel = "Về trang học sinh",
}: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="mb-8">
      <Link
        href={backHref}
        className="mb-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg font-bold text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        {backLabel}
      </Link>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground bg-secondary shadow-brutal-md">
          <BookOpen className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="rounded-full border-2 border-foreground bg-secondary-soft px-3 py-1 text-sm font-extrabold shadow-brutal-xs">
          Không gian học sinh
        </span>
      </div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-base font-semibold text-muted-foreground sm:text-lg">
        {description}
      </p>
    </header>
  );
}
