"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/config/routes";

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    const accessToken = searchParams.get("accessToken");
    if (!accessToken) {
      router.replace(ROUTES.login);
      return;
    }

    setSession(accessToken).then((user) => {
      if (!user) {
        router.replace(ROUTES.login);
        return;
      }
      router.replace(
        user.role === UserRole.TEACHER
          ? ROUTES.teacherDashboard
          : ROUTES.studentDashboard,
      );
    });
  }, [searchParams, setSession, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-4 py-16 text-foreground">
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      <p className="font-semibold">Đang hoàn tất đăng nhập...</p>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center bg-background px-4 py-16 text-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        </main>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
