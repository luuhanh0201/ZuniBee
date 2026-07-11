"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/lib/auth-context";

export function HomeAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    if (!user.roleSelected) {
      router.replace(ROUTES.oauthSelectRole);
      return;
    }
    router.replace(
      user.role === UserRole.TEACHER
        ? ROUTES.teacherDashboard
        : ROUTES.studentDashboard,
    );
  }, [isLoading, router, user]);

  if (isLoading || user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Đang tải" />
      </main>
    );
  }

  return <>{children}</>;
}
