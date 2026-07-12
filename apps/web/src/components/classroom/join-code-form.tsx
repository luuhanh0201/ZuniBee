"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, LogIn } from "lucide-react";
import type { JoinClassroomResult } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast-provider";
import { joinClassroomByCode } from "@/components/classroom/classroom-api";
import {
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";

type JoinCodeFormProps = {
  onJoined?: (result: JoinClassroomResult) => void;
  compact?: boolean;
};

export function JoinCodeForm({ onJoined, compact = false }: JoinCodeFormProps) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const requestLockRef = useRef(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<JoinClassroomResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestLockRef.current) return;

    const normalizedCode = code.trim().replace(/\s+/g, "").toUpperCase();
    if (!normalizedCode) {
      setError("Vui lòng nhập mã lớp do giáo viên cung cấp.");
      return;
    }
    if (!accessToken) {
      setError("Phiên đăng nhập chưa sẵn sàng. Vui lòng tải lại trang.");
      return;
    }

    requestLockRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const joined = await joinClassroomByCode(
        { code: normalizedCode },
        accessToken,
      );
      setResult(joined);
      setCode(normalizedCode);
      onJoined?.(joined);
      showToast(
        "success",
        joined.alreadyMember
          ? "Bạn đã ở trong lớp này."
          : `Đã tham gia lớp ${joined.classroom.name}!`,
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Chưa thể tham gia lớp. Vui lòng thử lại.",
      );
    } finally {
      requestLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="join-code-title"
      className={`rounded-2xl border-2 border-foreground bg-surface shadow-brutal-lg ${compact ? "p-5 sm:p-6" : "p-6 sm:p-8"}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
          <KeyRound className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h2
            id="join-code-title"
            className="font-display text-xl font-extrabold sm:text-2xl"
          >
            Nhập mã lớp
          </h2>
          <p className="mt-1 font-semibold text-muted-foreground">
            Mã không phân biệt chữ hoa, chữ thường hay khoảng trắng.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <label htmlFor="classroom-code" className="text-sm font-extrabold">
          Mã tham gia
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="classroom-code"
            name="code"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase().slice(0, 24));
              if (error) setError(null);
              if (result) setResult(null);
            }}
            maxLength={24}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            aria-describedby="classroom-code-help classroom-code-feedback"
            aria-invalid={Boolean(error)}
            placeholder="Ví dụ: ZB8K-2M4P"
            className={`${INPUT_CLASS} font-display font-extrabold uppercase tracking-[0.18em] sm:flex-1`}
          />
          <button
            type="submit"
            disabled={isSubmitting || !accessToken}
            className={`${PRIMARY_ACTION_CLASS} shrink-0 sm:min-w-40`}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="h-5 w-5" aria-hidden="true" />
            )}
            {isSubmitting ? "Đang tham gia..." : "Tham gia lớp"}
          </button>
        </div>
        <p
          id="classroom-code-help"
          className="mt-2 text-sm font-semibold text-muted-foreground"
        >
          Bạn có thể dán nguyên mã nhận từ giáo viên.
        </p>

        <div id="classroom-code-feedback" aria-live="polite">
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 font-bold"
            >
              {error}
            </p>
          ) : null}

          {result ? (
            <div
              role="status"
              className="mt-4 rounded-xl border-2 border-foreground bg-success-soft p-4 shadow-brutal-sm"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 h-6 w-6 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-display text-lg font-extrabold">
                    {result.alreadyMember
                      ? "Bạn đã là thành viên"
                      : "Tham gia lớp thành công!"}
                  </p>
                  <p className="mt-1 break-words font-semibold text-muted-foreground">
                    {result.classroom.name}
                  </p>
                </div>
              </div>
              <Link
                href="/student/classes"
                className={`${SECONDARY_ACTION_CLASS} mt-4 w-full sm:w-auto`}
              >
                Xem các lớp của tôi
              </Link>
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}
