import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { DashboardHeader } from "@/components/dashboard/demo-dashboard";

export const PRIMARY_ACTION_CLASS =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 py-3 font-bold text-foreground shadow-brutal-md transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-x-px hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-xs disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none disabled:shadow-brutal-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const SECONDARY_ACTION_CLASS =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-5 py-3 font-bold text-foreground shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-x-px hover:-translate-y-px hover:bg-surface-soft hover:shadow-brutal-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-xs disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const DANGER_ACTION_CLASS =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-2 font-bold text-foreground shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-x-px hover:-translate-y-px hover:bg-destructive hover:shadow-brutal-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-xs disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const INPUT_CLASS =
  "min-h-12 w-full rounded-xl border-2 border-foreground bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60";

export function TeacherClassroomFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <DashboardHeader role={UserRole.TEACHER} />
      <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

export function ClassroomPageHeader({
  title,
  description,
  backHref = "/teacher",
  backLabel = "Về trang giáo viên",
  actions,
}: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <Link
          href={backHref}
          className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded-lg font-bold text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {backLabel}
        </Link>
        <div className="mb-3 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground bg-secondary shadow-brutal-md">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="rounded-full border-2 border-foreground bg-secondary-soft px-3 py-1 text-sm font-extrabold">
            Không gian giáo viên
          </span>
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-muted-foreground sm:text-lg">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>
      ) : null}
    </header>
  );
}

export function ClassroomLoadingState({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-foreground bg-surface p-8 text-center shadow-brutal-lg"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-foreground bg-primary shadow-brutal-md">
        <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
      </span>
      <p className="font-bold">{label}</p>
    </div>
  );
}

export function ClassroomErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-2xl border-2 border-foreground bg-destructive-soft p-6 shadow-brutal-lg sm:p-8"
      role="alert"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl font-extrabold">
              Chưa tải được dữ liệu
            </h2>
            <p className="mt-1 font-semibold text-muted-foreground">
              {message}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className={SECONDARY_ACTION_CLASS}
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
          Thử lại
        </button>
      </div>
    </div>
  );
}

export function InlineSpinner({ label }: { label: string }) {
  return (
    <>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </>
  );
}
