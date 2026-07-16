import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ROUTES } from "@/config/routes";

type BrandLockupProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-primary text-on-primary shadow-brutal-sm ${className}`}
    >
      <Sparkles aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
    </span>
  );
}

export function BrandLockup({
  compact = false,
  className = "",
}: BrandLockupProps) {
  return (
    <Link
      href={ROUTES.home}
      aria-label="ZuniBee — Trang chủ"
      className={`inline-flex cursor-pointer items-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring ${className}`}
    >
      <BrandMark />
      {compact ? null : (
        <span className="font-brand text-xl font-bold tracking-[-0.04em] sm:text-2xl">
          Zuni<span className="text-secondary-strong">Bee</span>
        </span>
      )}
    </Link>
  );
}
