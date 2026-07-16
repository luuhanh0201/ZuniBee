import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export const PRIMARY_ACTION_CLASS =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 py-3 font-semibold text-on-primary shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-md active:translate-y-0 active:shadow-brutal-xs disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none disabled:shadow-brutal-xs focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring motion-reduce:transform-none";

export const SECONDARY_ACTION_CLASS =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-5 py-3 font-semibold text-foreground shadow-brutal-xs transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-surface-soft hover:shadow-brutal-sm active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none disabled:shadow-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring motion-reduce:transform-none";

export const DANGER_ACTION_CLASS =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-destructive bg-destructive-soft px-4 py-2 font-semibold text-foreground shadow-brutal-xs transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:shadow-brutal-sm active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none disabled:shadow-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring motion-reduce:transform-none";

export const INPUT_CLASS =
  "min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/75 transition-[border-color,box-shadow] duration-200 hover:border-foreground/60 focus-visible:border-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface-soft disabled:opacity-60";

export function TeacherClassroomFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Bỏ qua điều hướng
      </a>
      <DashboardHeader role={UserRole.TEACHER} />
      <main id="main-content" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
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
    <header className="mb-8 flex flex-col gap-6 border-b border-divider pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <Link
          href={backHref}
          className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded-lg font-bold text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {backLabel}
        </Link>
        <div className="editorial-label mb-3 flex items-center gap-2">
          <BookOpen
            className="h-4 w-4 text-secondary-strong"
            aria-hidden="true"
          />
          Không gian giáo viên
        </div>
        <h1 className="max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
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
      className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border border-divider bg-surface p-8 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
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
      className="rounded-2xl border border-destructive/30 bg-destructive-soft p-6 sm:p-8"
      role="alert"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl font-bold">
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
