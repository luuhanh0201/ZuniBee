"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/config/routes";

const DASHBOARD_BY_ROLE: Partial<Record<UserRole, string>> = {
  [UserRole.STUDENT]: ROUTES.studentDashboard,
  [UserRole.TEACHER]: ROUTES.teacherDashboard,
};

/** Cờ demo do OnboardingFlow lưu — cho phép xem dashboard không cần tài khoản thật. */
const DEMO_ROLE_STORAGE_KEY = "zunibee-demo-role";

/**
 * Chỉ render children khi:
 * - đã đăng nhập thật (AuthProvider) và đúng role, hoặc
 * - đang ở chế độ demo (chọn vai trò qua /onboarding, không cần tài khoản).
 * Ngược lại điều hướng về nơi phù hợp.
 */
export function RequireRole({
  role,
  children,
}: {
  role: UserRole.STUDENT | UserRole.TEACHER;
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const isDemoMode =
    !user &&
    typeof window !== "undefined" &&
    localStorage.getItem(DEMO_ROLE_STORAGE_KEY) === role;

  useEffect(() => {
    if (isLoading || isDemoMode) return;
    if (!user) {
      router.replace(ROUTES.login);
      return;
    }
    if (user.role !== role) {
      router.replace(DASHBOARD_BY_ROLE[user.role] ?? ROUTES.home);
    }
  }, [isLoading, isDemoMode, user, role, router]);

  const allowed = isDemoMode || (user && user.role === role);

  if (isLoading || !allowed) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      </main>
    );
  }

  return <>{children}</>;
}
