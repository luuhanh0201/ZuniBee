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
        <div aria-busy="false">
          <section
            className="mb-8 grid gap-4 sm:grid-cols-3"
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
            <h2 className="font-display text-2xl font-extrabold">
              Tất cả lớp học
            </h2>
            <button
              type="button"
              onClick={loadClassrooms}
              className={`${SECONDARY_ACTION_CLASS} min-h-10 px-4 py-2`}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Làm mới
            </button>
          </div>

          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
    <section className="relative overflow-hidden rounded-3xl border-[3px] border-foreground bg-surface p-7 shadow-brutal-2xl sm:p-10">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border-[3px] border-foreground bg-secondary-soft" />
      <div className="relative flex flex-col items-center text-center">
        <span className="mb-6 inline-flex h-24 w-24 -rotate-2 items-center justify-center rounded-3xl border-[3px] border-foreground bg-primary shadow-brutal-xl">
          <School className="h-12 w-12" aria-hidden="true" />
        </span>
        <span className="rounded-full border-2 border-foreground bg-success-soft px-3 py-1 text-sm font-extrabold">
          Bắt đầu thật nhanh
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold sm:text-3xl">
          Bạn chưa có lớp học nào
        </h2>
        <p className="mt-2 max-w-xl font-semibold text-muted-foreground">
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
    <article className="flex items-center gap-4 rounded-2xl border-2 border-foreground bg-surface p-4 shadow-brutal-md sm:p-5">
      <span
        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-foreground shadow-brutal-sm ${accent}`}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-display text-2xl font-extrabold">{value}</p>
        <p className="text-sm font-bold text-muted-foreground">{label}</p>
      </div>
    </article>
  );
}

function ClassroomCard({ classroom }: { classroom: ClassroomSummary }) {
  return (
    <li className="h-full">
      <article className="flex h-full flex-col rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-secondary shadow-brutal-sm">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </span>
          <span
            className={`rounded-full border-2 border-foreground px-3 py-1 text-xs font-extrabold ${
              classroom.status === "active"
                ? "bg-success-soft"
                : "bg-surface-soft"
            }`}
          >
            {classroom.status === "active" ? "Đang hoạt động" : "Đã lưu trữ"}
          </span>
        </div>

        <h3 className="font-display text-xl font-extrabold">
          {classroom.name}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-12 font-semibold text-muted-foreground">
          {classroom.description || "Chưa có mô tả cho lớp học này."}
        </p>

        <dl className="mt-5 space-y-3 border-y-2 border-divider py-4 text-sm font-bold">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              Môn / khối
            </dt>
            <dd className="truncate text-right">
              {[classroom.subject, classroom.grade]
                .filter(Boolean)
                .join(" · ") || "Chưa cập nhật"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden="true" />
              Sinh viên
            </dt>
            <dd>{classroom.memberCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Mã lớp
            </dt>
            <dd className="font-display tracking-widest">
              {classroom.joinCode}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Ngày tạo
            </dt>
            <dd>{formatDate(classroom.createdAt)}</dd>
          </div>
        </dl>

        <Link
          href={`/teacher/classes/${classroom.id}`}
          className={`${PRIMARY_ACTION_CLASS} mt-5 w-full`}
          aria-label={`Quản lý lớp ${classroom.name}`}
        >
          Quản lý lớp
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </article>
    </li>
  );
}
