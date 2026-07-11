"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/config/routes";

/** Chỉ render children khi đã đăng nhập tài khoản thật (không có chế độ demo). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || user) return;
    router.replace(ROUTES.login);
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      </main>
    );
  }

  return <>{children}</>;
}
