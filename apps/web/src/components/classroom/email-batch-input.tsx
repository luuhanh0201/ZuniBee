"use client";

import { AlertCircle, CheckCircle2, Copy, Mail } from "lucide-react";
import { INPUT_CLASS } from "./classroom-ui";
import { parseEmailBatch } from "./classroom-utils";

export function EmailBatchInput({
  value,
  onChange,
  disabled = false,
  id = "student-emails",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const parsed = parseEmailBatch(value);
  const isOverLimit = parsed.emails.length > 100;
  const hasTokens = value.trim().length > 0;
  const helpId = `${id}-help`;
  const validationId = `${id}-validation`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-extrabold">
        Email sinh viên
      </label>
      <div className="relative">
        <Mail
          className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={6}
          spellCheck={false}
          autoComplete="off"
          aria-describedby={`${helpId} ${hasTokens ? validationId : ""}`.trim()}
          aria-invalid={parsed.invalidEmails.length > 0 || isOverLimit}
          placeholder={"an@truong.edu.vn\nbinh@truong.edu.vn"}
          className={`${INPUT_CLASS} resize-y pl-12`}
        />
      </div>
      <p
        id={helpId}
        className="mt-2 text-sm font-semibold text-muted-foreground"
      >
        Dán nhiều email, phân tách bằng dấu phẩy, dấu chấm phẩy, khoảng trắng
        hoặc xuống dòng. Email trùng sẽ tự động được gộp; tối đa 100 email mỗi
        lần.
      </p>

      {hasTokens ? (
        <div
          id={validationId}
          className="mt-4 grid gap-3 sm:grid-cols-3"
          aria-live="polite"
        >
          <ValidationSummary
            icon={CheckCircle2}
            label="Hợp lệ"
            count={parsed.emails.length}
            className="bg-success-soft"
          />
          <ValidationSummary
            icon={Copy}
            label="Đã gộp trùng"
            count={parsed.duplicateEmails.length}
            className="bg-warning-soft"
          />
          <ValidationSummary
            icon={AlertCircle}
            label="Sai định dạng"
            count={parsed.invalidEmails.length}
            className={
              parsed.invalidEmails.length > 0
                ? "bg-destructive-soft"
                : "bg-surface-soft"
            }
          />
        </div>
      ) : null}

      {parsed.invalidEmails.length > 0 ? (
        <div
          className="mt-3 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 text-sm font-semibold"
          role="alert"
        >
          <p className="font-extrabold">Cần sửa email:</p>
          <p className="mt-1 break-words">{parsed.invalidEmails.join(", ")}</p>
        </div>
      ) : null}

      {isOverLimit ? (
        <p
          className="mt-3 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 text-sm font-extrabold"
          role="alert"
        >
          Mỗi lần chỉ được mời tối đa 100 email. Hiện có {parsed.emails.length}
          email hợp lệ.
        </p>
      ) : null}
    </div>
  );
}

function ValidationSummary({
  icon: Icon,
  label,
  count,
  className,
}: {
  icon: typeof CheckCircle2;
  label: string;
  count: number;
  className: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border-2 border-foreground px-3 py-2 ${className}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="text-sm font-bold">
        {label}: {count}
      </span>
    </div>
  );
}
