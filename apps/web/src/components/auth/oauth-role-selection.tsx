"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { ROUTES } from "@/config/routes";
import { ApiError, useAuth } from "@/lib/auth-context";
import {
  clearStoredAuthReturnTo,
  withReturnTo,
} from "@/components/classroom/safe-return-to";

type SelectableRole = UserRole.STUDENT | UserRole.TEACHER;

const roleOptions = [
  {
    role: UserRole.STUDENT,
    title: "Học sinh",
    description: "Tiếp tục hoạt động, nhận phản hồi và theo dõi tiến bộ.",
    icon: BookOpen,
    color: "bg-secondary-soft",
  },
  {
    role: UserRole.TEACHER,
    title: "Giáo viên",
    description: "Tổ chức nội dung, quản lý lớp và đồng hành cùng người học.",
    icon: GraduationCap,
    color: "bg-warning-soft",
  },
] as const;

export function OAuthRoleSelection({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const { user, isLoading, selectRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<SelectableRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      clearStoredAuthReturnTo();
      router.replace(withReturnTo(ROUTES.login, returnTo));
      return;
    }
    if (user.roleSelected) {
      clearStoredAuthReturnTo();
      router.replace(
        returnTo ??
          (user.role === UserRole.TEACHER
            ? ROUTES.teacherDashboard
            : ROUTES.studentDashboard),
      );
    }
  }, [isLoading, returnTo, router, user]);

  async function handleSubmit() {
    if (!selectedRole || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const updatedUser = await selectRole({ role: selectedRole });
      clearStoredAuthReturnTo();
      router.replace(
        returnTo ??
          (updatedUser.role === UserRole.TEACHER
            ? ROUTES.teacherDashboard
            : ROUTES.studentDashboard),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Không thể lưu vai trò, vui lòng thử lại.",
      );
      setIsSubmitting(false);
    }
  }

  if (isLoading || !user || user.roleSelected) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Đang tải" />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6">
      <section className="w-full max-w-4xl rounded-3xl border-2 border-foreground bg-surface p-5 shadow-brutal-lg sm:p-8 lg:p-10">
        <header className="max-w-2xl">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="editorial-label">Chào {user.fullName}!</p>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
            Chuẩn bị không gian phù hợp với bạn
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Vai trò quyết định navigation, công cụ và hành động tiếp theo mà
            ZuniBee ưu tiên cho bạn.
          </p>
        </header>

        <div
          className="mt-8 grid gap-4 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Chọn vai trò"
        >
          {roleOptions.map(
            ({ role, title, description, icon: Icon, color }) => {
              const selected = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedRole(role)}
                  className={`cursor-pointer rounded-2xl border-2 p-5 text-left transition-[border-color,box-shadow,background-color] duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring ${selected ? "border-foreground bg-primary shadow-brutal-xs" : "border-border bg-surface hover:border-foreground/60 hover:bg-surface-soft"}`}
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}
                  >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="mt-4 block font-display text-xl font-bold">
                    {title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {description}
                  </span>
                </button>
              );
            },
          )}
        </div>

        {error ? (
          <p
            className="mt-5 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 text-sm font-semibold"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!selectedRole || isSubmitting}
          onClick={handleSubmit}
          className="mt-7 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 py-3 font-semibold text-on-primary shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-md active:translate-y-0 active:shadow-brutal-xs disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring motion-reduce:transform-none"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : null}
          {isSubmitting ? "Đang thiết lập..." : "Tiếp tục"}
        </button>
      </section>
    </main>
  );
}
