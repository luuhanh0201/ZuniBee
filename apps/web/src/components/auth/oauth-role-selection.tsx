"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { ROUTES } from "@/config/routes";
import { ApiError, useAuth } from "@/lib/auth-context";

type SelectableRole = UserRole.STUDENT | UserRole.TEACHER;

const roleOptions = [
  {
    role: UserRole.STUDENT,
    title: "Học sinh",
    description: "Luyện quiz, tích lũy XP và theo dõi tiến bộ mỗi ngày.",
    icon: BookOpen,
    color: "bg-secondary-soft",
  },
  {
    role: UserRole.TEACHER,
    title: "Giáo viên",
    description: "Tạo bài học, quản lý lớp và đồng hành cùng học sinh.",
    icon: GraduationCap,
    color: "bg-warning-soft",
  },
] as const;

export function OAuthRoleSelection() {
  const router = useRouter();
  const { user, isLoading, selectRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<SelectableRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(ROUTES.login);
      return;
    }
    if (user.roleSelected) {
      router.replace(
        user.role === UserRole.TEACHER
          ? ROUTES.teacherDashboard
          : ROUTES.studentDashboard,
      );
    }
  }, [isLoading, router, user]);

  async function handleSubmit() {
    if (!selectedRole || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const updatedUser = await selectRole({ role: selectedRole });
      router.replace(
        updatedUser.role === UserRole.TEACHER
          ? ROUTES.teacherDashboard
          : ROUTES.studentDashboard,
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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground sm:px-6">
      <div
        aria-hidden="true"
        className="absolute -left-12 top-16 h-32 w-32 rounded-full border-2 border-foreground bg-secondary"
      />
      <div
        aria-hidden="true"
        className="absolute -right-10 bottom-12 h-28 w-28 rotate-12 rounded-3xl border-2 border-foreground bg-success"
      />

      <section className="relative z-10 w-full max-w-3xl rounded-3xl border-[3px] border-foreground bg-surface p-5 shadow-brutal-2xl sm:p-8">
        <header className="text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="font-bold text-secondary-strong">
            Chào {user.fullName}!
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
            Bạn muốn dùng ZuniBee với vai trò nào?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Chọn một vai trò để ZuniBee chuẩn bị không gian phù hợp nhất cho
            bạn.
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
                  className={`cursor-pointer rounded-2xl border-[3px] border-foreground p-5 text-left transition-[transform,box-shadow,background-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${selected ? "bg-purple-soft shadow-brutal-lg -translate-x-px -translate-y-px" : "bg-surface shadow-brutal-sm hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md"}`}
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 border-foreground ${color}`}
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
          className="mt-7 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 py-3 font-bold text-foreground shadow-brutal-md transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
