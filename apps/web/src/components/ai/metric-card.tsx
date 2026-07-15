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
    <article className="rounded-2xl border border-divider bg-surface p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/20 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-muted-foreground">{helper}</p>
    </article>
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
