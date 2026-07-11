export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-0.5 flex-1 bg-border" />
      <span className="text-xs font-bold uppercase tracking-wide text-foreground/50">
        {label}
      </span>
      <div className="h-0.5 flex-1 bg-border" />
    </div>
  );
}
