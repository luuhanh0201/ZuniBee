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
        className="mb-1.5 block text-sm font-bold text-foreground"
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
          className="min-h-12 w-full rounded-xl border-2 border-foreground bg-surface px-4 py-3 text-base text-foreground placeholder:text-foreground/40 transition-shadow duration-150 focus:shadow-brutal-sm focus:outline-none"
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-foreground/50 hover:text-foreground"
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
