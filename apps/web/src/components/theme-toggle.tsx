"use client";

import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "zunibee-theme";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";

    if (next === "dark") {
      root.dataset.theme = "dark";
    } else {
      delete root.dataset.theme;
    }

    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Chuyển chế độ sáng hoặc tối"
      title="Chuyển chế độ sáng hoặc tối"
      className="fixed bottom-4 right-4 z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface text-foreground shadow-brutal-sm transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:bottom-6 sm:right-6"
    >
      <Moon
        aria-hidden="true"
        className="theme-icon-moon h-5 w-5"
        strokeWidth={2.5}
      />
      <Sun
        aria-hidden="true"
        className="theme-icon-sun h-5 w-5"
        strokeWidth={2.5}
      />
    </button>
  );
}
