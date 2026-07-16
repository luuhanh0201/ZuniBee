"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  GraduationCap,
  KeyRound,
  Plus,
  RefreshCw,
  School,
  Users,
} from "lucide-react";
import type { ClassroomSummary } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { getTeacherClassrooms } from "./classroom-api";
import {
  ClassroomErrorState,
  ClassroomLoadingState,
  ClassroomPageHeader,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
  TeacherClassroomFrame,
} from "./classroom-ui";
import { formatDate, getErrorMessage } from "./classroom-utils";

export function TeacherClassroomsList() {
  const { accessToken } = useAuth();
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClassrooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getTeacherClassrooms(accessToken ?? undefined);
      setClassrooms(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    getTeacherClassrooms(accessToken ?? undefined)
      .then((response) => {
        if (cancelled) return;
        setClassrooms(response);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const totalStudents = classrooms.reduce(
    (sum, classroom) => sum + classroom.memberCount,
    0,
  );
  const pendingInvitations = classrooms.reduce(
    (sum, classroom) => sum + classroom.pendingInvitationCount,
    0,
  );

  return (
    <TeacherClassroomFrame>
      <ClassroomPageHeader
        title="Lớp học của tôi"
        description="Tạo lớp, quản lý danh sách sinh viên và chia sẻ quyền truy cập từ một nơi."
        actions={
          <Link href="/teacher/classes/new" className={PRIMARY_ACTION_CLASS}>
            <Plus className="h-5 w-5" aria-hidden="true" />
            Tạo lớp mới
          </Link>
        }
      />

      {isLoading ? (
        <ClassroomLoadingState label="Đang tải các lớp học..." />
      ) : error ? (
        <ClassroomErrorState message={error} onRetry={loadClassrooms} />
      ) : classrooms.length === 0 ? (
        <EmptyClassroomState />
      ) : (
        <div className="motion-enter" aria-busy="false">
          <section
            className="motion-stagger mb-9 grid overflow-hidden rounded-2xl border border-divider bg-surface sm:grid-cols-3 sm:divide-x sm:divide-divider"
            aria-label="Tổng quan lớp học"
          >
            <StatCard
              icon={School}
              label="Lớp đang quản lý"
              value={classrooms.length}
              accent="bg-secondary"
            />
            <StatCard
              icon={Users}
              label="Sinh viên"
              value={totalStudents}
              accent="bg-success"
            />
            <StatCard
              icon={Clock3}
              label="Lời mời đang chờ"
              value={pendingInvitations}
              accent="bg-primary"
            />
          </section>

          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">Tất cả lớp học</h2>
            <button
              type="button"
              onClick={loadClassrooms}
              className={`${SECONDARY_ACTION_CLASS} min-h-10 px-4 py-2`}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Làm mới
            </button>
          </div>

          <ul className="motion-stagger divide-y divide-divider overflow-hidden rounded-2xl border border-divider bg-surface">
            {classrooms.map((classroom) => (
              <ClassroomCard key={classroom.id} classroom={classroom} />
            ))}
          </ul>
        </div>
      )}
    </TeacherClassroomFrame>
  );
}

function EmptyClassroomState() {
  return (
    <section className="motion-enter rounded-3xl border-2 border-dashed border-border bg-surface p-7 sm:p-10">
      <div className="flex flex-col items-center text-center">
        <span className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-on-primary">
          <School className="h-12 w-12" aria-hidden="true" />
        </span>
        <p className="editorial-label">Điểm bắt đầu</p>
        <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
          Bạn chưa có lớp học nào
        </h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Tạo lớp đầu tiên, thêm sinh viên qua email rồi chia sẻ mã, link hoặc
          QR.
        </p>
        <Link
          href="/teacher/classes/new"
          className={`${PRIMARY_ACTION_CLASS} mt-7`}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          Tạo lớp đầu tiên
        </Link>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof School;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <article className="flex items-center gap-4 p-4 sm:p-5">
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </article>
  );
}

function ClassroomCard({ classroom }: { classroom: ClassroomSummary }) {
  return (
    <li>
      <article className="motion-lift grid gap-5 p-5 sm:p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex items-start gap-3 lg:self-start">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-soft text-secondary-strong">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              classroom.status === "active"
                ? "border-success/40 bg-success-soft"
                : "border-divider bg-surface-soft"
            }`}
          >
            {classroom.status === "active" ? "Đang hoạt động" : "Đã lưu trữ"}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold">{classroom.name}</h3>
          <p className="mt-1 line-clamp-2 text-muted-foreground">
            {classroom.description || "Chưa có mô tả cho lớp học này."}
          </p>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Môn / khối</span>
              </dt>
              <dd className="truncate font-medium">
                {[classroom.subject, classroom.grade]
                  .filter(Boolean)
                  .join(" · ") || "Chưa cập nhật"}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Sinh viên</span>
              </dt>
              <dd className="font-medium">{classroom.memberCount} học sinh</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Mã lớp</span>
              </dt>
              <dd className="font-display font-semibold tracking-widest">
                {classroom.joinCode}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Ngày tạo</span>
              </dt>
              <dd className="font-medium">{formatDate(classroom.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <Link
          href={`/teacher/classes/${classroom.id}`}
          className={SECONDARY_ACTION_CLASS}
          aria-label={`Quản lý lớp ${classroom.name}`}
        >
          Mở lớp
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </article>
    </li>
  );
}
