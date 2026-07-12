"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LibraryBig,
  Users,
} from "lucide-react";
import type { ClassroomSummary, JoinClassroomResult } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { getStudentClassrooms } from "@/components/classroom/classroom-api";
import { JoinCodeForm } from "@/components/classroom/join-code-form";
import {
  ClassroomErrorState,
  ClassroomLoadingState,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import {
  formatDate,
  getErrorMessage,
} from "@/components/classroom/classroom-utils";
import {
  StudentClassroomFrame,
  StudentClassroomPageHeader,
} from "@/components/classroom/student-classroom-frame";

type LoadState = "loading" | "ready" | "error" | "demo";

export function StudentClassrooms() {
  const { accessToken, user } = useAuth();
  const [classes, setClasses] = useState<ClassroomSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [resolvedRequestKey, setResolvedRequestKey] = useState("");
  const requestKey = `${accessToken ?? "no-token"}:${reloadKey}`;
  const visibleLoadState: LoadState = !accessToken
    ? user
      ? "error"
      : "demo"
    : resolvedRequestKey === requestKey
      ? loadState
      : "loading";
  const visibleLoadError =
    !accessToken && user
      ? "Phiên đăng nhập chưa sẵn sàng. Vui lòng thử tải lại."
      : loadError;

  useEffect(() => {
    let cancelled = false;

    if (!accessToken) {
      return () => {
        cancelled = true;
      };
    }

    getStudentClassrooms(accessToken)
      .then((data) => {
        if (cancelled) return;
        setClasses(data);
        setLoadState("ready");
        setResolvedRequestKey(requestKey);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(getErrorMessage(error));
        setLoadState("error");
        setResolvedRequestKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, requestKey]);

  function handleJoined(result: JoinClassroomResult) {
    setClasses((current) => [
      result.classroom,
      ...current.filter((item) => item.id !== result.classroom.id),
    ]);
    setLoadState("ready");
    setResolvedRequestKey(requestKey);
  }

  return (
    <StudentClassroomFrame>
      <StudentClassroomPageHeader
        title="Lớp học của tôi"
        description="Tham gia lớp bằng mã giáo viên gửi và theo dõi tất cả lớp bạn đang học."
      />

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <JoinCodeForm onJoined={handleJoined} compact />

        <aside className="rounded-2xl border-2 border-foreground bg-secondary-soft p-5 shadow-brutal-md sm:p-6">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-foreground bg-secondary shadow-brutal-sm">
            <GraduationCap className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-xl font-extrabold">
            Bạn cũng có thể dùng link hoặc QR
          </h2>
          <p className="mt-2 font-semibold leading-relaxed text-muted-foreground">
            Mở link mời hoặc quét QR từ giáo viên. ZuniBee sẽ xem trước thông
            tin lớp trước khi bạn xác nhận tham gia.
          </p>
        </aside>
      </div>

      <section aria-labelledby="my-classes-title" className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              Danh sách thật từ tài khoản
            </p>
            <h2
              id="my-classes-title"
              className="mt-1 font-display text-2xl font-extrabold sm:text-3xl"
            >
              Các lớp đã tham gia
            </h2>
          </div>
          {visibleLoadState === "ready" ? (
            <span className="rounded-full border-2 border-foreground bg-success-soft px-3 py-1.5 text-sm font-extrabold shadow-brutal-xs">
              {classes.length} lớp
            </span>
          ) : null}
        </div>

        {visibleLoadState === "loading" ? (
          <ClassroomLoadingState label="Đang tải các lớp của bạn..." />
        ) : null}

        {visibleLoadState === "error" ? (
          <ClassroomErrorState
            message={visibleLoadError}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        ) : null}

        {visibleLoadState === "demo" ? (
          <div className="rounded-2xl border-2 border-foreground bg-warning-soft p-6 shadow-brutal-md sm:p-8">
            <h3 className="font-display text-xl font-extrabold">
              Cần tài khoản thật để tải lớp
            </h3>
            <p className="mt-2 font-semibold text-muted-foreground">
              Chế độ demo không có dữ liệu lớp. Hãy đăng nhập tài khoản học sinh
              để tham gia và xem lớp của bạn.
            </p>
            <Link href="/login" className={`${SECONDARY_ACTION_CLASS} mt-5`}>
              Đăng nhập
            </Link>
          </div>
        ) : null}

        {visibleLoadState === "ready" && classes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-foreground bg-surface p-8 text-center shadow-brutal-md sm:p-12">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-primary shadow-brutal-md">
              <LibraryBig className="h-8 w-8" aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-display text-2xl font-extrabold">
              Chưa có lớp nào
            </h3>
            <p className="mx-auto mt-2 max-w-lg font-semibold text-muted-foreground">
              Nhập mã ở phía trên, hoặc mở link và QR mà giáo viên đã gửi để bắt
              đầu.
            </p>
          </div>
        ) : null}

        {visibleLoadState === "ready" && classes.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((classroom) => (
              <article
                key={classroom.id}
                className="flex min-w-0 flex-col rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
                    <BookOpen className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span
                    className={`rounded-full border-2 border-foreground px-3 py-1 text-xs font-extrabold ${classroom.status === "active" ? "bg-success-soft" : "bg-surface-soft"}`}
                  >
                    {classroom.status === "active" ? "Đang học" : "Đã lưu trữ"}
                  </span>
                </div>

                <h3 className="mt-5 break-words font-display text-xl font-extrabold">
                  {classroom.name}
                </h3>
                <p className="mt-2 line-clamp-2 min-h-12 font-semibold text-muted-foreground">
                  {classroom.description ||
                    "Giáo viên chưa thêm mô tả cho lớp."}
                </p>

                <dl className="mt-5 space-y-3 border-t-2 border-divider pt-4 text-sm font-semibold">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <LibraryBig className="h-4 w-4" aria-hidden="true" />
                      Môn học
                    </dt>
                    <dd className="text-right font-extrabold">
                      {classroom.subject || "Chưa cập nhật"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" aria-hidden="true" />
                      Thành viên
                    </dt>
                    <dd className="font-extrabold tabular-nums">
                      {classroom.memberCount}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      Tạo ngày
                    </dt>
                    <dd className="font-extrabold tabular-nums">
                      {formatDate(classroom.createdAt)}
                    </dd>
                  </div>
                </dl>

                <Link
                  href={`/student/classes/${classroom.id}`}
                  className={`${SECONDARY_ACTION_CLASS} mt-5 w-full`}
                  aria-label={`Vào lớp ${classroom.name}`}
                >
                  Vào lớp
                </Link>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </StudentClassroomFrame>
  );
}
