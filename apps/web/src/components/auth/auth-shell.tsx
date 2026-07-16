import Link from "next/link";
import { BookOpen, Check, Sparkles } from "lucide-react";
import { BrandLockup } from "@/components/ui/brand-lockup";

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
    <main className="flex flex-1 items-center bg-background px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="motion-enter mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl border-2 border-foreground bg-surface shadow-brutal-lg lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="relative hidden overflow-hidden border-r border-divider bg-surface-soft p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <BrandLockup />
            <p className="editorial-label mt-14 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
              Không gian học tập của bạn
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight">
              Quay lại đúng nơi bạn đang học dở.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Lớp học, tài liệu và hoạt động được giữ trong một mạch để bạn luôn
              biết bước tiếp theo.
            </p>
          </div>
          <ul className="motion-stagger mt-12 space-y-4 text-sm font-medium">
            {[
              "Tiếp tục hoạt động gần nhất",
              "Nhận phản hồi ngay trong ngữ cảnh",
              "Theo dõi tiến bộ từ công việc thật",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-on-primary">
                  <Check
                    className="h-4 w-4"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <div className="p-5 sm:p-8 lg:p-12">
          <BrandLockup className="mb-8 lg:hidden" />
          <section className="motion-stagger mx-auto max-w-md">
            <div>
              <p className="editorial-label flex items-center gap-2">
                <BookOpen
                  className="h-4 w-4 text-secondary-strong"
                  aria-hidden="true"
                />
                ZuniBee account
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                {subtitle}
              </p>
            </div>

            <div className="mt-7">{children}</div>

            <p className="mt-7 border-t border-divider pt-6 text-center text-sm text-muted-foreground">
              {footer.text}{" "}
              <Link
                href={footer.href}
                className="cursor-pointer font-semibold text-foreground underline decoration-2 underline-offset-4 transition-colors hover:text-secondary-strong focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
              >
                {footer.linkLabel}
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
