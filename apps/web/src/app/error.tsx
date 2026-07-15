"use client";

import { useEffect } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Lỗi giao diện chưa được xử lý:", error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-foreground/50 p-4 backdrop-blur-[2px]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-error-title"
        aria-describedby="app-error-description"
        className="w-full max-w-md rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-xl sm:p-6"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-foreground bg-destructive-soft shadow-brutal-sm">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1
          id="app-error-title"
          className="mt-4 font-display text-2xl font-extrabold"
        >
          Giao diện đang gặp sự cố
        </h1>
        <p
          id="app-error-description"
          className="mt-2 font-semibold leading-relaxed text-muted-foreground"
        >
          Hệ thống chưa thể hiển thị nội dung này. Bạn có thể thử tải lại phần
          hiện tại hoặc quay về trang chủ.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs font-bold text-muted-foreground">
            Mã đối chiếu: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-4 font-extrabold transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Về trang chủ
          </button>
          <button
            type="button"
            autoFocus
            onClick={unstable_retry}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 font-extrabold shadow-brutal-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </button>
        </div>
      </div>
    </div>
  );
}
