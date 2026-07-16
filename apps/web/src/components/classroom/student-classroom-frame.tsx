"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export function StudentClassroomFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Bỏ qua điều hướng
      </a>
      <DashboardHeader role={UserRole.STUDENT} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8"
      >
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
    <header className="mb-8 border-b border-divider pb-7">
      <Link
        href={backHref}
        className="mb-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg font-bold text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        {backLabel}
      </Link>
      <div className="editorial-label mb-3 flex items-center gap-2">
        <BookOpen
          className="h-4 w-4 text-secondary-strong"
          aria-hidden="true"
        />
        Không gian học sinh
      </div>
      <h1 className="max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
        {description}
      </p>
    </header>
  );
}
