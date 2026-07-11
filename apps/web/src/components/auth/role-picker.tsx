"use client";

import { useState } from "react";
import { GraduationCap, BookOpen, Check } from "lucide-react";
import { UserRole } from "@zunibee/shared";

type SelectableRole = UserRole.STUDENT | UserRole.TEACHER;

const OPTIONS: {
  value: SelectableRole;
  label: string;
  icon: typeof GraduationCap;
}[] = [
  { value: UserRole.TEACHER, label: "Giáo viên", icon: GraduationCap },
  { value: UserRole.STUDENT, label: "Học sinh", icon: BookOpen },
];

export function RolePicker() {
  const [role, setRole] = useState<SelectableRole | null>(null);

  return (
    <div role="radiogroup" aria-label="Bạn là Giáo viên hay Học sinh?">
      <p className="mb-1.5 block text-sm font-bold text-foreground">
        Bạn là Giáo viên hay Học sinh?
      </p>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = role === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setRole(value)}
              className={`relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-foreground px-3 py-4 text-sm font-bold transition-[transform,box-shadow,background-color] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                selected
                  ? "-translate-x-px -translate-y-px bg-primary text-foreground shadow-brutal-md"
                  : "bg-surface text-foreground/70 shadow-brutal-xs hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-sm"
              }`}
            >
              {selected ? (
                <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-foreground bg-success">
                  <Check
                    className="h-3.5 w-3.5 text-foreground"
                    strokeWidth={3}
                  />
                </span>
              ) : null}
              <Icon className="h-6 w-6" strokeWidth={2.5} />
              {label}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="role" value={role ?? ""} />
    </div>
  );
}
