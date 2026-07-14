import type { Cpu } from "lucide-react";

export function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  color,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  helper: string;
  color: string;
}) {
  return (
    <article className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-foreground shadow-brutal-sm ${color}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">
        {helper}
      </p>
    </article>
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
