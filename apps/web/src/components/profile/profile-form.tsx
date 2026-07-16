"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Camera,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  Save,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { ROUTES } from "@/config/routes";
import { ApiError, useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast-provider";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function ProfileForm() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  if (!user) return null;
  const currentAvatar = user.avatar;

  const dashboardUrl =
    user.role === UserRole.TEACHER
      ? ROUTES.teacherDashboard
      : ROUTES.studentDashboard;
  const RoleIcon = user.role === UserRole.TEACHER ? GraduationCap : BookOpen;
  const initials = user.fullName
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = new FormData(event.currentTarget);
    const optionalValue = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value || null;
    };
    setIsSubmitting(true);
    setError("");
    try {
      const avatar = avatarFile
        ? await uploadAvatar(avatarFile)
        : currentAvatar;
      await updateProfile({
        fullName: String(form.get("fullName") ?? "").trim(),
        phone: optionalValue("phone"),
        avatar,
      });
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      showToast("success", "Đã cập nhật hồ sơ của bạn.");
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Không thể cập nhật hồ sơ, vui lòng thử lại.";
      setError(message);
      showToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAvatarChange(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setError("Ảnh phải có định dạng JPEG, PNG, WebP hoặc GIF.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError("Ảnh đại diện không được lớn hơn 5 MB.");
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError("");
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={dashboardUrl}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Quay lại bảng điều khiển
        </Link>

        <div className="mt-6 grid overflow-hidden rounded-3xl border-2 border-foreground bg-surface shadow-brutal-lg lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="border-b border-divider bg-surface-soft p-6 lg:border-b-0 lg:border-r lg:p-8">
            <label className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-foreground bg-primary font-display text-3xl font-bold shadow-brutal-xs transition-[box-shadow] duration-200 hover:shadow-brutal-sm focus-within:outline focus-within:outline-3 focus-within:outline-offset-4 focus-within:outline-ring">
              {avatarPreview || user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview ?? user.avatar ?? ""}
                  alt="Ảnh đại diện xem trước"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-banner/85 py-1.5 text-xs font-bold text-white opacity-90 transition-opacity group-hover:opacity-100">
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                Thay ảnh
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                aria-label="Chọn ảnh đại diện mới"
                onChange={(event) =>
                  handleAvatarChange(event.target.files?.[0])
                }
              />
            </label>
            <h1 className="mt-5 font-display text-3xl font-bold">
              Hồ sơ của bạn
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Cập nhật thông tin để trải nghiệm ZuniBee gần gũi và chính xác
              hơn.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-divider bg-surface px-3 py-2 font-semibold">
              <RoleIcon className="h-5 w-5" aria-hidden="true" />
              {user.role === UserRole.TEACHER ? "Giáo viên" : "Học sinh"}
            </div>
            <p className="mt-6 text-xs font-semibold text-muted-foreground">
              Vai trò được bảo vệ để đảm bảo đúng quyền truy cập.
              <br />
            </p>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-full flex-col p-5 sm:p-8"
          >
            <p className="editorial-label">Thông tin cá nhân</p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              Chỉnh sửa hồ sơ
            </h2>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <ProfileField
                icon={UserRound}
                label="Họ và tên"
                name="fullName"
                defaultValue={user.fullName}
                autoComplete="name"
                required
              />
              <ProfileField
                icon={Mail}
                label="Email"
                name="email"
                type="email"
                defaultValue={user.email ?? ""}
                autoComplete="email"
                disabled
              />
              <ProfileField
                icon={Phone}
                label="Số điện thoại"
                name="phone"
                defaultValue={user.phone ?? ""}
                autoComplete="tel"
                placeholder="0901 234 567"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-5 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 text-sm font-semibold"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-auto flex flex-col-reverse gap-3 pt-10 sm:flex-row sm:justify-end">
              <Link
                href={ROUTES.changePassword}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface px-5 font-semibold shadow-brutal-xs transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
              >
                Đổi mật khẩu
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 font-semibold text-on-primary shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-md disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring motion-reduce:transform-none"
              >
                {isSubmitting ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save className="h-5 w-5" aria-hidden="true" />
                )}
                {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

type ProfileFieldProps = {
  icon: LucideIcon;
  label: string;
  name: string;
  type?: "text" | "email" | "url";
  defaultValue: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

function ProfileField({
  icon: Icon,
  label,
  name,
  type = "text",
  ...props
}: ProfileFieldProps) {
  return (
    <label className="block text-sm font-semibold">
      <span className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      <input
        name={name}
        type={type}
        className="min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 py-3 font-medium text-foreground placeholder:text-muted-foreground/60 transition-[border-color,box-shadow] duration-200 hover:border-foreground/60 focus:border-foreground focus:outline focus:outline-3 focus:outline-offset-2 focus:outline-ring disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted-foreground"
        {...props}
      />
    </label>
  );
}
