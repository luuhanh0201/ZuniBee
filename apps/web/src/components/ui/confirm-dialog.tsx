"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  /** danger đổi nút xác nhận sang màu phá hủy. */
  tone?: "default" | "danger";
  /** Bắt gõ đúng chuỗi này mới cho xác nhận (dành cho hành động phá hủy). */
  requireText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Dialog xác nhận dùng chung cho các hành động cần cân nhắc. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "default",
  requireText,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  // Reset chuỗi xác nhận mỗi lần mở lại dialog (adjust-during-render).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setTyped("");
  }
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const confirmDisabled =
    loading || (Boolean(requireText) && typed.trim() !== requireText);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[60] grid place-items-center bg-foreground/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-lg">
        <div className="flex items-start gap-3">
          {tone === "danger" ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-destructive-soft shadow-brutal-sm">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
          <div>
            <h3
              id="confirm-dialog-title"
              className="font-display text-2xl font-extrabold"
            >
              {title}
            </h3>
            <div className="mt-2 font-semibold text-muted-foreground">
              {description}
            </div>
          </div>
        </div>
        {requireText ? (
          <label className="mt-4 block font-extrabold">
            Gõ{" "}
            <span className="font-mono text-sm font-bold">{requireText}</span>{" "}
            để xác nhận
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="mt-2 min-h-11 w-full rounded-xl border-2 border-foreground bg-background px-3 font-semibold outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={loading}
            onClick={onClose}
            className="min-h-11 cursor-pointer rounded-xl border-2 border-foreground bg-surface px-4 font-extrabold transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground px-4 font-extrabold shadow-brutal-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              tone === "danger"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-primary hover:shadow-brutal-md"
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
