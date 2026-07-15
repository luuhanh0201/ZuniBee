"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";
import { API_ERROR_EVENT, type ApiErrorEventDetail } from "@/lib/api-client";

type ToastVariant = "error" | "success" | "info";
type TransientToastVariant = Exclude<ToastVariant, "error">;

type Toast = {
  id: number;
  variant: TransientToastVariant;
  message: string;
};

type ErrorNotification = {
  id: number;
  message: string;
  status?: number;
};

type ToastContextValue = {
  showToast: (variant: ToastVariant, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLE: Record<
  TransientToastVariant,
  { icon: LucideIcon; bg: string; anim: string }
> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-success-soft",
    anim: "motion-safe:animate-[toast-slide-in_280ms_ease-out]",
  },
  info: {
    icon: Info,
    bg: "bg-secondary-soft",
    anim: "motion-safe:animate-[toast-slide-in_280ms_ease-out]",
  },
};

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [errors, setErrors] = useState<ErrorNotification[]>([]);
  const nextId = useRef(0);
  const recentErrors = useRef(new Map<string, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const dismissError = useCallback(() => {
    setErrors((current) => current.slice(1));
  }, []);

  const enqueueError = useCallback((message: string, status?: number) => {
    const normalized = message.trim();
    if (!normalized) return;
    const now = Date.now();
    const lastShownAt = recentErrors.current.get(normalized) ?? 0;
    if (now - lastShownAt < 1_500) return;
    recentErrors.current.set(normalized, now);
    const id = nextId.current++;
    setErrors((current) => {
      if (current.some((item) => item.message === normalized)) return current;
      return [...current.slice(-3), { id, message: normalized, status }];
    });
  }, []);

  const showToast = useCallback(
    (variant: ToastVariant, message: string) => {
      if (variant === "error") {
        enqueueError(message);
        return;
      }
      const id = nextId.current++;
      setToasts((current) => [...current, { id, variant, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss, enqueueError],
  );

  useEffect(() => {
    const onApiError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorEventDetail>).detail;
      if (detail?.message) enqueueError(detail.message, detail.status);
    };
    window.addEventListener(API_ERROR_EVENT, onApiError);
    return () => window.removeEventListener(API_ERROR_EVENT, onApiError);
  }, [enqueueError]);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </div>
      <ErrorNotificationDialog
        notification={errors[0] ?? null}
        onDismiss={dismissError}
      />
    </ToastContext.Provider>
  );
}

function ErrorNotificationDialog({
  notification,
  onDismiss,
}: {
  notification: ErrorNotification | null;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!notification) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    actionRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [notification, onDismiss]);

  if (!notification) return null;
  const title = errorTitle(notification.status, notification.message);
  const hint = errorRecoveryHint(notification.status);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-foreground/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notification-dialog-title"
        aria-describedby="notification-dialog-description"
        className="w-full max-w-md rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-xl motion-safe:animate-[toast-slide-in_220ms_ease-out] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-destructive-soft shadow-brutal-sm">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="notification-dialog-title"
              className="font-display text-xl font-extrabold"
            >
              {title}
            </h2>
            <p
              id="notification-dialog-description"
              className="mt-2 break-words font-semibold leading-relaxed text-muted-foreground"
            >
              {notification.message}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Đóng thông báo lỗi"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-soft hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-4 rounded-xl bg-warning-soft px-3 py-2 text-sm font-bold">
          {hint}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            ref={actionRef}
            type="button"
            onClick={onDismiss}
            className="min-h-11 cursor-pointer rounded-xl border-2 border-foreground bg-primary px-5 font-extrabold shadow-brutal-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}

function errorTitle(status: number | undefined, message: string): string {
  if (status === 429 || message.includes("thao tác quá nhanh"))
    return "Yêu cầu đang bị giới hạn";
  if (status === 401) return "Phiên đăng nhập không hợp lệ";
  if (status === 403) return "Không có quyền thực hiện";
  if (status === 404) return "Không tìm thấy dữ liệu";
  if (status === 0) return "Không thể kết nối máy chủ";
  if (status && status >= 500) return "Hệ thống đang gặp sự cố";
  return "Không thể thực hiện yêu cầu";
}

function errorRecoveryHint(status?: number): string {
  if (status === 429)
    return "Hãy chờ một lúc rồi thử lại; không cần nhấn liên tục.";
  if (status === 401)
    return "Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.";
  if (status === 0)
    return "Kiểm tra kết nối mạng, sau đó thực hiện lại thao tác.";
  return "Bạn có thể đóng thông báo và thử lại thao tác vừa thực hiện.";
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const { icon: Icon, bg, anim } = VARIANT_STYLE[toast.variant];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-2 rounded-xl border-2 border-foreground ${bg} px-4 py-3 text-sm font-semibold text-foreground shadow-brutal-md ${anim}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Đóng thông báo"
        className="shrink-0 cursor-pointer rounded-md text-foreground/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải được dùng trong <ToastProvider>");
  return ctx;
}
