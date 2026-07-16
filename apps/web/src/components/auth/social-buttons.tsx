"use client";

import { GoogleIcon, FacebookIcon } from "@/components/icons/brand-icons";
import { storeAuthReturnTo } from "@/components/classroom/safe-return-to";
import { API_URL } from "@/lib/api-client";

export function SocialButtons({ returnTo }: { returnTo?: string }) {
  function preserveReturnTo() {
    storeAuthReturnTo(returnTo);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Điều hướng cả trang (không dùng router.push) vì OAuth cần redirect thật sang Google/Facebook */}
      <a
        href={`${API_URL}/auth/google`}
        onClick={preserveReturnTo}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-divider bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-[border-color,background-color] duration-200 hover:border-foreground/40 hover:bg-surface-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
      >
        <GoogleIcon className="h-5 w-5" />
        Google
      </a>
      <a
        href={`${API_URL}/auth/facebook`}
        onClick={preserveReturnTo}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-divider bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-[border-color,background-color] duration-200 hover:border-foreground/40 hover:bg-surface-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
      >
        <FacebookIcon className="h-5 w-5" />
        Facebook
      </a>
    </div>
  );
}
