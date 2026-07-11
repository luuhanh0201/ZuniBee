import { GoogleIcon, FacebookIcon } from "@/components/icons/brand-icons";
import { API_URL } from "@/lib/api-client";

export function SocialButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Điều hướng cả trang (không dùng router.push) vì OAuth cần redirect thật sang Google/Facebook */}
      <a
        href={`${API_URL}/auth/google`}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-4 py-2.5 text-sm font-bold text-foreground shadow-brutal-sm transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <GoogleIcon className="h-5 w-5" />
        Google
      </a>
      <a
        href={`${API_URL}/auth/facebook`}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-4 py-2.5 text-sm font-bold text-foreground shadow-brutal-sm transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <FacebookIcon className="h-5 w-5" />
        Facebook
      </a>
    </div>
  );
}
