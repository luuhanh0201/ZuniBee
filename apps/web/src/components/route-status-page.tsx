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
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6 sm:py-14"
    >
      {/* Hình trang trí — cùng bảng màu brand, không mang ý nghĩa, ẩn với screen reader */}
      <div
        aria-hidden="true"
        className="absolute -left-12 top-16 h-36 w-36 rounded-full border-2 border-foreground bg-secondary sm:left-[8%] sm:top-20"
      />
      <div
        aria-hidden="true"
        className="absolute -right-10 bottom-12 h-28 w-28 rotate-12 rounded-3xl border-2 border-foreground bg-destructive sm:right-[10%] sm:h-36 sm:w-36"
      />

      <section className="relative z-10 grid w-full max-w-5xl items-center gap-8 rounded-3xl border-[3px] border-foreground bg-surface p-5 shadow-brutal-2xl sm:p-8 md:grid-cols-[0.9fr_1.1fr] md:gap-12 lg:p-12">
        <div className="relative mx-auto flex min-h-64 w-full max-w-sm items-center justify-center sm:min-h-80">
          <div
            aria-hidden="true"
            className="absolute left-2 top-4 rotate-[-7deg] rounded-xl border-2 border-foreground bg-primary px-4 py-2 font-display text-sm font-bold text-on-primary shadow-brutal-md sm:left-4"
          >
            {sticker}
          </div>

          <div
            className={`relative flex h-48 w-48 rotate-3 items-center justify-center rounded-[2.5rem] border-[3px] border-foreground ${accentBg} shadow-brutal-xl sm:h-56 sm:w-56`}
          >
            <span className="font-display text-[5.5rem] font-bold leading-none tracking-[-0.08em] text-foreground sm:text-[6.5rem]">
              {code}
            </span>
            <div
              aria-hidden="true"
              className={`absolute -bottom-5 -right-5 flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl border-[3px] border-foreground ${accentBg} shadow-brutal-lg sm:h-20 sm:w-20`}
            >
              <Icon className="h-9 w-9 text-foreground" strokeWidth={2.5} />
            </div>
          </div>

          <div
            aria-hidden="true"
            className="absolute bottom-1 left-4 h-7 w-7 rounded-full border-2 border-foreground bg-destructive sm:left-8"
          />
          <div
            aria-hidden="true"
            className="absolute right-5 top-10 h-5 w-5 rotate-12 border-2 border-foreground bg-secondary sm:right-8"
          />
        </div>

        <div className="text-center md:text-left">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-background px-3 py-1.5 text-sm font-bold shadow-brutal-sm">
            <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            {eyebrow}
          </div>

          <h1
            id="route-status-title"
            className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-[2.75rem]"
          >
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base font-medium leading-relaxed text-foreground/70 sm:text-lg md:mx-0">
            {description}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Link
              href={primaryAction.href}
              className="group inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 py-3 font-bold text-on-primary shadow-brutal-md transition-[transform,box-shadow] duration-200 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-xs motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <PrimaryIcon aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
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
                className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface px-6 py-3 font-bold text-foreground shadow-brutal-md transition-[transform,box-shadow] duration-200 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-xs motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {secondaryAction.label}
              </Link>
            ) : null}
          </div>

          <p className="mt-5 text-sm font-semibold text-foreground/70">
            Mã lỗi: <span className="tabular-nums text-foreground">{code}</span>
          </p>
        </div>
      </section>
    </main>
  );
}
