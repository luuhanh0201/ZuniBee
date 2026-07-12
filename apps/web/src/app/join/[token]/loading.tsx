import { Loader2 } from "lucide-react";

export default function ClassroomJoinLoading() {
  return (
    <main
      className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-background px-4 py-16 text-foreground"
      role="status"
      aria-live="polite"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-foreground bg-primary shadow-brutal-md">
        <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
      </span>
      <p className="font-bold">Đang mở lời mời lớp học...</p>
    </main>
  );
}
