"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type TextFieldProps = {
  label: string;
  type?: "text" | "email" | "password";
  name: string;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
};

export function TextField({
  label,
  type = "text",
  name,
  autoComplete,
  placeholder,
  defaultValue,
}: TextFieldProps) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={inputType}
          autoComplete={autoComplete}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/65 transition-[border-color,box-shadow] duration-200 hover:border-foreground/60 focus:border-foreground focus:outline focus:outline-3 focus:outline-offset-2 focus:outline-ring"
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-soft hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" strokeWidth={2} />
            ) : (
              <Eye className="h-5 w-5" strokeWidth={2} />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
