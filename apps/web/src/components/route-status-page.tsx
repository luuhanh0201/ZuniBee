import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Home } from "lucide-react";

type Accent = "secondary" | "destructive" | "success";

const ACCENT_BG: Record<Accent, string> = {
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  success: "bg-success",
};

type ActionLink = { href: string; label: string; icon?: LucideIcon };

type RouteStatusPageProps = {
  code: string;
  icon: LucideIcon;
  /** Accent màu cho khối số lỗi + badge icon — mỗi loại lỗi 1 màu để phân biệt trực quan */
  accent: Accent;
  /** Text trên nhãn ghim xoay nghiêng, vd "Lạc đường rồi!" */
  sticker: string;
  /** Text trên pill nhỏ phía trên tiêu đề, vd "Trang không tồn tại" */
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: ActionLink;
  secondaryAction?: ActionLink;
};

export function RouteStatusPage({
  code,
  icon: Icon,
  accent,
  sticker,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
}: RouteStatusPageProps) {
  const accentBg = ACCENT_BG[accent];
  const PrimaryIcon = primaryAction.icon ?? Home;

  return (
    <main
      aria-labelledby="route-status-title"
      className="flex flex-1 items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6 sm:py-14"
    >
      <section className="motion-enter grid w-full max-w-5xl items-center overflow-hidden rounded-3xl border-2 border-foreground bg-surface shadow-brutal-lg md:grid-cols-[0.8fr_1.2fr]">
        <div className="relative mx-auto flex min-h-64 w-full max-w-sm items-center justify-center sm:min-h-80">
          <div
            aria-hidden="true"
            className="absolute left-5 top-5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
          >
            {sticker}
          </div>

          <div
            className={`motion-pop motion-delay-1 relative flex h-48 w-48 items-center justify-center rounded-[2.5rem] border-2 border-foreground ${accentBg} shadow-brutal-sm sm:h-56 sm:w-56`}
          >
            <span className="font-display text-[5.5rem] font-bold leading-none tracking-[-0.08em] text-foreground sm:text-[6.5rem]">
              {code}
            </span>
            <div
              aria-hidden="true"
              className="absolute -bottom-3 -right-3 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-surface shadow-brutal-sm sm:h-20 sm:w-20"
            >
              <Icon className="h-9 w-9 text-foreground" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <div className="motion-stagger border-t border-divider p-6 text-center sm:p-9 md:border-l md:border-t-0 md:text-left lg:p-12">
          <div className="editorial-label mb-4 inline-flex items-center gap-2">
            <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            {eyebrow}
          </div>

          <h1
            id="route-status-title"
            className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-[2.75rem]"
          >
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg md:mx-0">
            {description}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Link
              href={primaryAction.href}
              className="group inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 py-3 font-semibold text-on-primary shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-md active:translate-y-0 active:shadow-brutal-xs motion-reduce:transform-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
            >
              <PrimaryIcon
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2.5}
              />
              {primaryAction.label}
              <ArrowRight
                aria-hidden="true"
                className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                strokeWidth={2.5}
              />
            </Link>
            {secondaryAction ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface px-6 py-3 font-semibold text-foreground shadow-brutal-xs transition-[background-color,box-shadow] duration-200 ease-out hover:bg-surface-soft hover:shadow-brutal-sm focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
              >
                {secondaryAction.label}
              </Link>
            ) : null}
          </div>

          <p className="mt-5 text-sm font-medium text-muted-foreground">
            Mã lỗi: <span className="tabular-nums text-foreground">{code}</span>
          </p>
        </div>
      </section>
    </main>
  );
}
