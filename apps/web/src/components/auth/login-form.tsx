"use client";

import { TextField } from "@/components/ui/text-field";
import { SocialButtons } from "@/components/auth/social-buttons";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/config/routes";

export function LoginForm() {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          router.push(ROUTES.onboarding);
        }}
        noValidate
        className="space-y-4"
      >
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
        />
        <TextField
          label="Mật khẩu"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground/80">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer rounded border-2 border-foreground accent-primary"
            />
            Ghi nhớ đăng nhập
          </label>
          <a
            href="#"
            className="cursor-pointer font-semibold text-foreground underline decoration-2 underline-offset-2 hover:text-primary"
          >
            Quên mật khẩu?
          </a>
        </div>

        <button
          type="submit"
          className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-primary px-6 py-3 font-bold text-foreground shadow-brutal-md transition-[transform,box-shadow] duration-200 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Đăng nhập bản demo
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-0.5 flex-1 bg-border" />
        <span className="text-xs font-bold uppercase tracking-wide text-foreground/50">
          Hoặc
        </span>
        <div className="h-0.5 flex-1 bg-border" />
      </div>

      <SocialButtons />
    </div>
  );
}
