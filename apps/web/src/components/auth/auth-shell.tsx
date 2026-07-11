import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ROUTES } from "@/config/routes";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: { text: string; linkLabel: string; href: string };
};

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6 sm:py-14">
      {/* Hình trang trí — cùng bảng màu brand, ẩn với screen reader */}
      <div
        aria-hidden="true"
        className="absolute -left-14 top-10 h-32 w-32 rounded-full border-2 border-foreground bg-secondary sm:left-[6%]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-12 bottom-10 h-28 w-28 rotate-12 rounded-3xl border-2 border-foreground bg-success sm:right-[8%]"
      />

      <div className="relative z-10 w-full max-w-md">
        <Link
          href={ROUTES.home}
          className="mb-6 flex cursor-pointer items-center justify-center gap-2 font-display text-xl font-bold text-foreground"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
            <GraduationCap
              className="h-5 w-5 text-foreground"
              strokeWidth={2.5}
            />
          </span>
          ZuniBee
        </Link>

        <section className="rounded-3xl border-[3px] border-foreground bg-surface p-6 shadow-brutal-2xl sm:p-8">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm font-medium text-foreground/70 sm:text-base">
              {subtitle}
            </p>
          </div>

          <div className="mt-6">{children}</div>
        </section>

        <p className="mt-6 text-center text-sm font-semibold text-foreground/70">
          {footer.text}{" "}
          <Link
            href={footer.href}
            className="cursor-pointer text-foreground underline decoration-2 underline-offset-2 hover:text-primary"
          >
            {footer.linkLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
