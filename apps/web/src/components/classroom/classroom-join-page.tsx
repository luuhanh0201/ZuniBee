"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Link2,
  Loader2,
  LogIn,
  Mail,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRoundX,
} from "lucide-react";
import {
  UserRole,
  type ClassroomJoinPreview,
  type JoinClassroomResult,
} from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast-provider";
import {
  acceptClassroomJoin,
  previewClassroomJoin,
  type ClassroomJoinKind,
} from "@/components/classroom/classroom-api";
import {
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import { formatDateTime } from "@/components/classroom/classroom-utils";
import { withReturnTo } from "@/components/classroom/safe-return-to";

type PreviewState =
  | { requestKey: string; status: "error"; message: string }
  | { requestKey: string; status: "ready"; preview: ClassroomJoinPreview };

function maskEmail(email: string): string {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

export function ClassroomJoinPage({
  token,
  kind,
}: {
  token: string;
  kind: ClassroomJoinKind;
}) {
  const { user, accessToken, isLoading: isAuthLoading, logout } = useAuth();
  const { showToast } = useToast();
  const acceptLockRef = useRef(false);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [joinResult, setJoinResult] = useState<JoinClassroomResult | null>(
    null,
  );
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  const returnTo = `/join/${encodeURIComponent(token)}${
    kind === "invitation" ? "?type=invitation" : ""
  }`;
  const loginHref = withReturnTo("/login", returnTo);
  const registerHref = withReturnTo("/register", returnTo);
  const previewRequestKey = `${kind}:${token}:${retryKey}`;
  const visiblePreviewState =
    previewState?.requestKey === previewRequestKey ? previewState : null;

  useEffect(() => {
    let cancelled = false;

    previewClassroomJoin(token, kind)
      .then((preview) => {
        if (!cancelled) {
          setPreviewState({
            requestKey: previewRequestKey,
            status: "ready",
            preview,
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPreviewState({
          requestKey: previewRequestKey,
          status: "error",
          message:
            error instanceof ApiError
              ? error.message
              : "Không thể kiểm tra lời mời lúc này. Vui lòng thử lại.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [kind, previewRequestKey, token]);

  async function handleAccept() {
    if (
      acceptLockRef.current ||
      !accessToken ||
      user?.role !== UserRole.STUDENT
    ) {
      return;
    }

    acceptLockRef.current = true;
    setIsAccepting(true);
    setAcceptError(null);

    try {
      const result = await acceptClassroomJoin(token, kind, accessToken);
      setJoinResult(result);
      showToast(
        "success",
        result.alreadyMember
          ? "Bạn đã ở trong lớp này."
          : `Đã tham gia lớp ${result.classroom.name}!`,
      );
    } catch (error) {
      setAcceptError(
        error instanceof ApiError
          ? error.message
          : "Chưa thể tham gia lớp. Vui lòng thử lại.",
      );
    } finally {
      acceptLockRef.current = false;
      setIsAccepting(false);
    }
  }

  async function handleSwitchAccount() {
    if (isSwitchingAccount) return;
    setIsSwitchingAccount(true);
    await logout();
    setIsSwitchingAccount(false);
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b-2 border-foreground bg-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link
            href="/"
            className="flex cursor-pointer items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="font-display text-xl font-extrabold">ZuniBee</span>
          </Link>
          <span className="hidden rounded-full border-2 border-foreground bg-secondary-soft px-3 py-1.5 text-sm font-extrabold shadow-brutal-xs sm:inline-flex">
            Lời mời lớp học
          </span>
        </div>
      </header>

      <main className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-14">
        <div
          aria-hidden="true"
          className="absolute -left-16 top-10 h-32 w-32 rounded-full border-2 border-foreground bg-secondary"
        />
        <div
          aria-hidden="true"
          className="absolute -right-16 bottom-12 h-32 w-32 rotate-12 rounded-3xl border-2 border-foreground bg-success"
        />

        <div className="relative mx-auto max-w-3xl">
          {!visiblePreviewState ? (
            <div
              className="flex min-h-96 flex-col items-center justify-center gap-4 rounded-3xl border-[3px] border-foreground bg-surface p-8 text-center shadow-brutal-2xl"
              role="status"
              aria-live="polite"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-primary shadow-brutal-md">
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
              </span>
              <h1 className="font-display text-2xl font-extrabold">
                Đang kiểm tra lớp học...
              </h1>
              <p className="font-semibold text-muted-foreground">
                ZuniBee đang xác minh link trước khi bạn tham gia.
              </p>
            </div>
          ) : null}

          {visiblePreviewState?.status === "error" ? (
            <section
              className="rounded-3xl border-[3px] border-foreground bg-surface p-6 shadow-brutal-2xl sm:p-10"
              aria-labelledby="invalid-invite-title"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-destructive shadow-brutal-lg">
                <AlertCircle className="h-8 w-8" aria-hidden="true" />
              </span>
              <h1
                id="invalid-invite-title"
                className="mt-6 font-display text-3xl font-extrabold"
              >
                Lời mời không khả dụng
              </h1>
              <p
                role="alert"
                className="mt-3 font-semibold text-muted-foreground"
              >
                {visiblePreviewState.message}
              </p>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Link có thể đã hết hạn, bị thu hồi hoặc được nhập chưa đúng.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setRetryKey((value) => value + 1)}
                  className={PRIMARY_ACTION_CLASS}
                >
                  <RefreshCw className="h-5 w-5" aria-hidden="true" />
                  Thử kiểm tra lại
                </button>
                <Link href="/" className={SECONDARY_ACTION_CLASS}>
                  Về trang chủ
                </Link>
              </div>
            </section>
          ) : null}

          {visiblePreviewState?.status === "ready" ? (
            <JoinPreviewCard
              preview={visiblePreviewState.preview}
              kind={kind}
              user={user}
              isAuthLoading={isAuthLoading}
              isAccepting={isAccepting}
              isSwitchingAccount={isSwitchingAccount}
              acceptError={acceptError}
              joinResult={joinResult}
              loginHref={loginHref}
              registerHref={registerHref}
              onAccept={handleAccept}
              onSwitchAccount={handleSwitchAccount}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function JoinPreviewCard({
  preview,
  kind,
  user,
  isAuthLoading,
  isAccepting,
  isSwitchingAccount,
  acceptError,
  joinResult,
  loginHref,
  registerHref,
  onAccept,
  onSwitchAccount,
}: {
  preview: ClassroomJoinPreview;
  kind: ClassroomJoinKind;
  user: ReturnType<typeof useAuth>["user"];
  isAuthLoading: boolean;
  isAccepting: boolean;
  isSwitchingAccount: boolean;
  acceptError: string | null;
  joinResult: JoinClassroomResult | null;
  loginHref: string;
  registerHref: string;
  onAccept: () => void;
  onSwitchAccount: () => void;
}) {
  const KindIcon = kind === "invitation" ? Mail : Link2;
  const invitedEmail = preview.invitedEmail?.toLowerCase() ?? null;
  const currentEmail = user?.email?.toLowerCase() ?? null;
  const hasEmailMismatch = Boolean(
    kind === "invitation" &&
    invitedEmail &&
    currentEmail &&
    invitedEmail !== currentEmail,
  );

  return (
    <article className="overflow-hidden rounded-3xl border-[3px] border-foreground bg-surface shadow-brutal-2xl">
      <div className="border-b-[3px] border-foreground bg-secondary-soft p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[3px] border-foreground bg-secondary shadow-brutal-lg">
            <KindIcon className="h-8 w-8" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span className="inline-flex rounded-full border-2 border-foreground bg-surface px-3 py-1 text-sm font-extrabold shadow-brutal-xs">
              {kind === "invitation" ? "Mời qua email" : "Link tham gia lớp"}
            </span>
            <h1 className="mt-4 break-words font-display text-3xl font-extrabold sm:text-4xl">
              {preview.classroom.name}
            </h1>
            <p className="mt-2 font-semibold text-muted-foreground">
              Giáo viên {preview.classroom.teacherName} mời bạn tham gia lớp.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <dl className="grid gap-3 sm:grid-cols-2">
          <PreviewDetail
            icon={BookOpen}
            label="Môn học"
            value={preview.classroom.subject || "Chưa cập nhật"}
          />
          <PreviewDetail
            icon={GraduationCap}
            label="Khối / lớp"
            value={preview.classroom.grade || "Chưa cập nhật"}
          />
          {preview.expiresAt ? (
            <PreviewDetail
              icon={CalendarClock}
              label="Hạn lời mời"
              value={formatDateTime(preview.expiresAt)}
            />
          ) : null}
          {preview.invitedEmail ? (
            <PreviewDetail
              icon={Mail}
              label="Email được mời"
              value={maskEmail(preview.invitedEmail)}
            />
          ) : null}
        </dl>

        <div className="mt-7 border-t-2 border-divider pt-7" aria-live="polite">
          {joinResult ? (
            <div
              role="status"
              className="rounded-2xl border-2 border-foreground bg-success-soft p-5 shadow-brutal-md sm:p-6"
            >
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              <h2 className="mt-3 font-display text-2xl font-extrabold">
                {joinResult.alreadyMember
                  ? "Bạn đã ở trong lớp này"
                  : "Tham gia lớp thành công!"}
              </h2>
              <p className="mt-2 font-semibold text-muted-foreground">
                Lớp đã có trong danh sách học tập của bạn.
              </p>
              <Link
                href="/student/classes"
                className={`${PRIMARY_ACTION_CLASS} mt-5 w-full sm:w-auto`}
              >
                Xem lớp của tôi
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          ) : isAuthLoading ? (
            <div
              role="status"
              className="flex min-h-24 items-center justify-center gap-3 rounded-2xl border-2 border-foreground bg-surface-soft p-5 font-bold"
            >
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Đang kiểm tra đăng nhập...
            </div>
          ) : !user ? (
            <div className="rounded-2xl border-2 border-foreground bg-warning-soft p-5 shadow-brutal-md sm:p-6">
              <LogIn className="h-7 w-7" aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-extrabold">
                Đăng nhập để xác nhận
              </h2>
              <p className="mt-2 font-semibold text-muted-foreground">
                Thông tin lớp vẫn ở đây. Sau khi đăng nhập hoặc đăng ký, bạn sẽ
                được đưa trở lại lời mời này.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link href={loginHref} className={PRIMARY_ACTION_CLASS}>
                  Đăng nhập
                </Link>
                <Link href={registerHref} className={SECONDARY_ACTION_CLASS}>
                  Tạo tài khoản học sinh
                </Link>
              </div>
            </div>
          ) : !user.roleSelected ? (
            <div
              role="alert"
              className="rounded-2xl border-2 border-foreground bg-warning-soft p-5 shadow-brutal-md sm:p-6"
            >
              <ShieldAlert className="h-7 w-7" aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-extrabold">
                Hãy chọn vai trò Học sinh
              </h2>
              <p className="mt-2 font-semibold text-muted-foreground">
                Bạn cần hoàn tất chọn vai trò trước khi tham gia lớp.
              </p>
              <Link
                href="/oauth/select-role"
                className={`${PRIMARY_ACTION_CLASS} mt-5`}
              >
                Chọn vai trò
              </Link>
            </div>
          ) : user.role !== UserRole.STUDENT ? (
            <div
              role="alert"
              className="rounded-2xl border-2 border-foreground bg-destructive-soft p-5 shadow-brutal-md sm:p-6"
            >
              <ShieldAlert className="h-7 w-7" aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-extrabold">
                Tài khoản giáo viên không thể tham gia lớp
              </h2>
              <p className="mt-2 font-semibold text-muted-foreground">
                Chỉ tài khoản học sinh được nhận lời mời này. Hãy đổi sang tài
                khoản học sinh nếu bạn muốn tham gia.
              </p>
              <button
                type="button"
                onClick={onSwitchAccount}
                disabled={isSwitchingAccount}
                className={`${SECONDARY_ACTION_CLASS} mt-5`}
              >
                {isSwitchingAccount ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <UserRoundX className="h-5 w-5" aria-hidden="true" />
                )}
                {isSwitchingAccount ? "Đang đổi tài khoản..." : "Đổi tài khoản"}
              </button>
            </div>
          ) : hasEmailMismatch ? (
            <div
              role="alert"
              className="rounded-2xl border-2 border-foreground bg-destructive-soft p-5 shadow-brutal-md sm:p-6"
            >
              <UserRoundX className="h-7 w-7" aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-extrabold">
                Lời mời dành cho email khác
              </h2>
              <p className="mt-2 font-semibold text-muted-foreground">
                Hãy đăng nhập bằng đúng email được giáo viên mời để tiếp tục.
              </p>
              <button
                type="button"
                onClick={onSwitchAccount}
                disabled={isSwitchingAccount}
                className={`${SECONDARY_ACTION_CLASS} mt-5`}
              >
                {isSwitchingAccount ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <UserRoundX className="h-5 w-5" aria-hidden="true" />
                )}
                {isSwitchingAccount ? "Đang đổi tài khoản..." : "Đổi tài khoản"}
              </button>
            </div>
          ) : (
            <div>
              <h2 className="font-display text-xl font-extrabold">
                Sẵn sàng tham gia?
              </h2>
              <p className="mt-2 font-semibold text-muted-foreground">
                Xác nhận để thêm lớp này vào tài khoản học sinh của bạn.
              </p>
              {acceptError ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 font-bold"
                >
                  {acceptError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={onAccept}
                disabled={isAccepting}
                className={`${PRIMARY_ACTION_CLASS} mt-5 w-full sm:w-auto`}
              >
                {isAccepting ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                )}
                {isAccepting ? "Đang tham gia..." : "Xác nhận tham gia lớp"}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function PreviewDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border-2 border-foreground bg-surface-soft p-4">
      <dt className="flex items-center gap-2 text-sm font-extrabold text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-2 break-words font-display text-lg font-extrabold">
        {value}
      </dd>
    </div>
  );
}
