"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  BookOpenText,
  CalendarClock,
  Clock3,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import {
  UserRole,
  type ClassroomSummary,
  type QuizSummary,
  type StudentQuizItem,
} from "@zunibee/shared";
import {
  publicQuizRoute,
  quizAttemptRoute,
  ROUTES,
  teacherQuizRoute,
} from "@/config/routes";
import { useAuth } from "@/lib/auth-context";
import {
  getStudentClassrooms,
  getTeacherClassrooms,
} from "@/components/classroom/classroom-api";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import {
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import { listQuizzes, listStudentQuizzes } from "@/components/quiz/quiz-api";
import {
  DashboardHeader,
  type DashboardRole,
} from "@/components/dashboard/dashboard-header";

type StudentDashboardData = {
  kind: "student";
  classrooms: ClassroomSummary[];
  quizzes: StudentQuizItem[];
};

type TeacherDashboardData = {
  kind: "teacher";
  classrooms: ClassroomSummary[];
  quizzes: QuizSummary[];
};

type DashboardData = StudentDashboardData | TeacherDashboardData;

export function DemoDashboard({ role }: { role: DashboardRole }) {
  const { accessToken, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    const request: Promise<DashboardData> =
      role === UserRole.STUDENT
        ? Promise.all([
            getStudentClassrooms(accessToken),
            listStudentQuizzes(accessToken),
          ]).then(([classrooms, quizzes]) => ({
            kind: "student" as const,
            classrooms,
            quizzes,
          }))
        : Promise.all([
            getTeacherClassrooms(accessToken),
            listQuizzes(accessToken),
          ]).then(([classrooms, quizzes]) => ({
            kind: "teacher" as const,
            classrooms,
            quizzes,
          }));

    request
      .then((nextData) => {
        if (active) {
          setData(nextData);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [accessToken, reload, role]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Bỏ qua điều hướng
      </a>
      <DashboardHeader role={role} />

      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8"
      >
        <header className="motion-enter mb-8 grid gap-5 border-b border-divider pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="editorial-label">
              {role === UserRole.STUDENT
                ? "Không gian học hôm nay"
                : "Không gian giảng dạy"}
            </p>
            <h1 className="mt-2 max-w-4xl font-display text-3xl font-bold sm:text-4xl lg:text-5xl">
              {role === UserRole.STUDENT
                ? `Chào ${firstName(user?.fullName)}, hôm nay bạn sẽ học gì?`
                : `Chào ${firstName(user?.fullName)}, bắt đầu từ nội dung quan trọng nhất.`}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {role === UserRole.STUDENT
                ? "Tiếp tục hoạt động gần nhất, hoàn thành phần được giao rồi quay lại ôn những gì cần nhớ."
                : "Tạo nội dung, đưa vào lớp học và theo dõi phản hồi trong cùng một mạch làm việc."}
            </p>
          </div>
          {role === UserRole.TEACHER ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={ROUTES.teacherCreateClassroom}
                className={SECONDARY_ACTION_CLASS}
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
                Tạo lớp
              </Link>
              <Link
                href={ROUTES.teacherLessons}
                className={PRIMARY_ACTION_CLASS}
              >
                <BookOpenText className="h-5 w-5" aria-hidden="true" />
                Tạo bài học
              </Link>
            </div>
          ) : null}
        </header>

        {!data && !error ? <DashboardLoading /> : null}
        {error ? (
          <DashboardError
            message={error}
            onRetry={() => setReload((value) => value + 1)}
          />
        ) : null}
        {data?.kind === "student" ? <StudentDashboard data={data} /> : null}
        {data?.kind === "teacher" ? <TeacherDashboard data={data} /> : null}
      </main>
    </div>
  );
}

function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const nextQuiz = useMemo(
    () =>
      data.quizzes.find((quiz) => quiz.state === "in_progress") ??
      data.quizzes.find((quiz) => quiz.state === "available") ??
      data.quizzes.find((quiz) => quiz.state === "upcoming") ??
      null,
    [data.quizzes],
  );
  const completed = data.quizzes.filter(
    (quiz) => quiz.state === "completed",
  ).length;
  const inProgress = data.quizzes.filter(
    (quiz) => quiz.state === "in_progress",
  ).length;
  const pending = data.quizzes.filter((quiz) =>
    ["available", "upcoming"].includes(quiz.state),
  ).length;

  return (
    <>
      <section
        aria-labelledby="today-plan-title"
        className="motion-enter motion-delay-1 grid overflow-hidden rounded-3xl border-2 border-foreground bg-surface shadow-brutal-lg lg:grid-cols-[1.45fr_0.55fr]"
      >
        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-y-0 left-0 w-2 bg-primary" />
          <div className="pl-2 sm:pl-3">
            <p className="editorial-label flex items-center gap-2">
              <CalendarClock
                className="h-4 w-4 text-secondary-strong"
                aria-hidden="true"
              />
              Kế hoạch tiếp theo
            </p>
            <h2
              id="today-plan-title"
              className="mt-4 max-w-3xl font-display text-3xl font-bold sm:text-4xl"
            >
              {nextQuiz
                ? nextQuiz.title
                : "Bạn đã xử lý xong các hoạt động hiện có."}
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground sm:text-lg">
              {nextQuiz
                ? nextQuiz.description ||
                  `${nextQuiz.questionCount} câu từ ${nextQuiz.teacherName}.`
                : "Tham gia một lớp học hoặc xem lại kết quả cũ để tiếp tục củng cố kiến thức."}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {nextQuiz && studentQuizHref(nextQuiz) ? (
                <Link
                  href={studentQuizHref(nextQuiz) ?? ROUTES.studentQuizzes}
                  className={PRIMARY_ACTION_CLASS}
                >
                  {nextQuiz.state === "in_progress" ? (
                    <Clock3 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                  )}
                  {nextQuiz.state === "in_progress"
                    ? "Tiếp tục hoạt động"
                    : "Bắt đầu hoạt động"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <Link
                  href={ROUTES.studentClasses}
                  className={PRIMARY_ACTION_CLASS}
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                  Tham gia lớp học
                </Link>
              )}
              <Link
                href={ROUTES.studentQuizzes}
                className={SECONDARY_ACTION_CLASS}
              >
                Xem tất cả hoạt động
              </Link>
            </div>
          </div>
        </div>

        <aside className="border-t border-divider bg-surface-soft p-6 lg:border-l lg:border-t-0 lg:p-8">
          <p className="editorial-label">Nhịp học hiện tại</p>
          <dl className="mt-5 space-y-5">
            <DashboardMetric label="Đang thực hiện" value={inProgress} />
            <DashboardMetric label="Đang chờ" value={pending} />
            <DashboardMetric label="Đã hoàn thành" value={completed} />
          </dl>
        </aside>
      </section>

      <div className="motion-stagger mt-10 grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
        <section aria-labelledby="assigned-title">
          <SectionHeading
            label="Hành trình gần đây"
            title="Hoạt động được giao"
            id="assigned-title"
            href={ROUTES.studentQuizzes}
          />
          {data.quizzes.length ? (
            <div className="motion-stagger mt-5 overflow-hidden rounded-2xl border-2 border-foreground bg-surface shadow-brutal-sm">
              {data.quizzes.slice(0, 5).map((quiz) => (
                <StudentActivityRow key={quiz.id} quiz={quiz} />
              ))}
            </div>
          ) : (
            <EmptyPanel
              icon={BookOpenCheck}
              title="Chưa có hoạt động được giao"
              description="Khi giáo viên giao nội dung, hoạt động tiếp theo sẽ xuất hiện tại đây."
              action={
                <Link
                  href={ROUTES.studentClasses}
                  className={SECONDARY_ACTION_CLASS}
                >
                  Xem lớp học
                </Link>
              }
            />
          )}
        </section>

        <aside aria-labelledby="classrooms-title">
          <SectionHeading
            label="Không gian đang tham gia"
            title="Lớp học của bạn"
            id="classrooms-title"
            href={ROUTES.studentClasses}
          />
          <div className="motion-stagger mt-5 space-y-3">
            {data.classrooms.slice(0, 4).map((classroom) => (
              <Link
                key={classroom.id}
                href={`${ROUTES.studentClasses}/${encodeURIComponent(classroom.id)}`}
                className="motion-lift group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-divider bg-surface p-4 transition-[border-color,background-color] duration-200 hover:border-foreground/40 hover:bg-surface-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {classroom.name}
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {[classroom.subject, classroom.grade]
                      .filter(Boolean)
                      .join(" · ") || "Không gian học tập"}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              </Link>
            ))}
            {!data.classrooms.length ? (
              <EmptyPanel
                compact
                icon={BookOpen}
                title="Chưa tham gia lớp học"
                description="Dùng mã hoặc liên kết từ giáo viên để bắt đầu."
                action={
                  <Link
                    href={ROUTES.studentClasses}
                    className={SECONDARY_ACTION_CLASS}
                  >
                    Tham gia lớp
                  </Link>
                }
              />
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}

function TeacherDashboard({ data }: { data: TeacherDashboardData }) {
  const totalStudents = data.classrooms.reduce(
    (total, classroom) => total + classroom.memberCount,
    0,
  );
  const published = data.quizzes.filter(
    (quiz) => quiz.status === "published",
  ).length;
  const drafts = data.quizzes.length - published;

  return (
    <>
      <section className="motion-enter motion-delay-1 grid overflow-hidden rounded-3xl border-2 border-foreground bg-surface shadow-brutal-lg lg:grid-cols-[1.3fr_0.7fr]">
        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-y-0 left-0 w-2 bg-primary" />
          <div className="pl-2 sm:pl-3">
            <p className="editorial-label flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
              AI theo đúng ngữ cảnh
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-3xl font-bold sm:text-4xl">
              Biến tài liệu đang có thành một hoạt động học có thể sử dụng ngay.
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground sm:text-lg">
              Tải nguồn, để AI dựng bản nháp, sau đó bạn kiểm tra và quyết định
              cách phân phối cho lớp.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={ROUTES.teacherLessons}
                className={PRIMARY_ACTION_CLASS}
              >
                <BookOpenText className="h-5 w-5" aria-hidden="true" />
                Tạo bài học theo chủ đề
              </Link>
              <Link
                href={ROUTES.teacherQuizzes}
                className={SECONDARY_ACTION_CLASS}
              >
                Mở thư viện nội dung
              </Link>
            </div>
          </div>
        </div>

        <aside className="border-t border-divider bg-surface-soft p-6 lg:border-l lg:border-t-0 lg:p-8">
          <p className="editorial-label">Tổng quan thực tế</p>
          <dl className="mt-5 space-y-5">
            <DashboardMetric
              label="Lớp đang quản lý"
              value={data.classrooms.length}
            />
            <DashboardMetric label="Học sinh trong lớp" value={totalStudents} />
            <DashboardMetric label="Nội dung đã phát hành" value={published} />
            <DashboardMetric label="Bản nháp đang soạn" value={drafts} />
          </dl>
        </aside>
      </section>

      <div className="motion-stagger mt-10 grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
        <section aria-labelledby="content-title">
          <SectionHeading
            label="Luồng tạo nội dung"
            title="Nội dung gần đây"
            id="content-title"
            href={ROUTES.teacherQuizzes}
          />
          {data.quizzes.length ? (
            <div className="motion-stagger mt-5 overflow-hidden rounded-2xl border-2 border-foreground bg-surface shadow-brutal-sm">
              {data.quizzes.slice(0, 5).map((quiz) => (
                <Link
                  key={quiz.id}
                  href={teacherQuizRoute(quiz.id)}
                  className="motion-lift group grid cursor-pointer gap-3 border-b border-divider p-5 transition-colors duration-200 last:border-b-0 hover:bg-surface-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-ring sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-display text-lg font-semibold">
                        {quiz.title}
                      </span>
                      <StatusLabel
                        label={
                          quiz.status === "published"
                            ? "Đã phát hành"
                            : "Bản nháp"
                        }
                        tone={
                          quiz.status === "published" ? "success" : "neutral"
                        }
                      />
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {quiz.questionCount} hoạt động · cập nhật{" "}
                      {formatDate(quiz.updatedAt)}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground group-hover:text-foreground">
                    Tiếp tục soạn
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyPanel
              icon={FileText}
              title="Chưa có nội dung học"
              description="Tạo bản đầu tiên từ tài liệu hoặc bắt đầu thủ công."
              action={
                <Link
                  href={ROUTES.teacherCreateAiQuiz}
                  className={PRIMARY_ACTION_CLASS}
                >
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                  Tạo với AI
                </Link>
              }
            />
          )}
        </section>

        <aside aria-labelledby="teacher-classrooms-title">
          <SectionHeading
            label="Phân phối và đồng hành"
            title="Lớp học"
            id="teacher-classrooms-title"
            href={ROUTES.teacherClasses}
          />
          <div className="motion-stagger mt-5 space-y-3">
            {data.classrooms.slice(0, 4).map((classroom) => (
              <Link
                key={classroom.id}
                href={`${ROUTES.teacherClasses}/${encodeURIComponent(classroom.id)}`}
                className="motion-lift group block cursor-pointer rounded-2xl border border-divider bg-surface p-4 transition-[border-color,background-color] duration-200 hover:border-foreground/40 hover:bg-surface-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {classroom.name}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {classroom.memberCount} học sinh ·{" "}
                      {classroom.pendingInvitationCount} lời mời chờ
                    </span>
                  </span>
                  <Users
                    className="h-5 w-5 shrink-0 text-secondary-strong"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
            {!data.classrooms.length ? (
              <EmptyPanel
                compact
                icon={GraduationCap}
                title="Chưa có lớp học"
                description="Tạo lớp để đưa nội dung đến đúng người học."
                action={
                  <Link
                    href={ROUTES.teacherCreateClassroom}
                    className={SECONDARY_ACTION_CLASS}
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                    Tạo lớp
                  </Link>
                }
              />
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}

function StudentActivityRow({ quiz }: { quiz: StudentQuizItem }) {
  const href = studentQuizHref(quiz);
  const label =
    quiz.state === "in_progress"
      ? "Đang thực hiện"
      : quiz.state === "completed"
        ? "Đã hoàn thành"
        : quiz.state === "upcoming"
          ? "Sắp mở"
          : quiz.state === "overdue"
            ? "Quá hạn"
            : "Sẵn sàng";

  const content = (
    <>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-lg font-semibold">
            {quiz.title}
          </span>
          <StatusLabel
            label={label}
            tone={
              quiz.state === "completed"
                ? "success"
                : quiz.state === "in_progress"
                  ? "brand"
                  : "neutral"
            }
          />
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {quiz.teacherName} · {quiz.questionCount} câu
        </span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
        aria-hidden="true"
      />
    </>
  );

  return href ? (
    <Link
      href={href}
      className="motion-lift group flex cursor-pointer items-center justify-between gap-4 border-b border-divider p-5 transition-colors duration-200 last:border-b-0 hover:bg-surface-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
    >
      {content}
    </Link>
  ) : (
    <div className="flex items-center justify-between gap-4 border-b border-divider p-5 last:border-b-0">
      {content}
    </div>
  );
}

function SectionHeading({
  label,
  title,
  id,
  href,
}: {
  label: string;
  title: string;
  id: string;
  href: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="editorial-label">{label}</p>
        <h2
          id={id}
          className="mt-1 font-display text-2xl font-bold sm:text-3xl"
        >
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-xl px-2 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Xem tất cả
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function DashboardMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-divider pb-4 last:border-b-0 last:pb-0">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function StatusLabel({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "brand";
}) {
  const className =
    tone === "success"
      ? "border-success/40 bg-success-soft"
      : tone === "brand"
        ? "border-foreground/50 bg-primary"
        : "border-divider bg-surface-soft";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  action: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-dashed border-border bg-surface text-center ${compact ? "p-5" : "mt-5 p-8 sm:p-10"}`}
    >
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-surface-soft text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      <div className="mt-5 flex justify-center">{action}</div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div
      className="grid min-h-80 place-items-center rounded-3xl border border-divider bg-surface p-8"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-secondary-strong"
          aria-hidden="true"
        />
        <p className="mt-3 font-medium">Đang chuẩn bị không gian của bạn...</p>
      </div>
    </div>
  );
}

function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-3xl border-2 border-destructive bg-destructive-soft p-6 sm:p-8"
      role="alert"
    >
      <h2 className="font-display text-2xl font-bold">
        Chưa thể chuẩn bị không gian học tập
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={`${SECONDARY_ACTION_CLASS} mt-5`}
      >
        <RefreshCw className="h-5 w-5" aria-hidden="true" />
        Thử lại
      </button>
    </div>
  );
}

function studentQuizHref(quiz: StudentQuizItem): string | null {
  if (quiz.inProgressAttemptId)
    return quizAttemptRoute(quiz.inProgressAttemptId);
  if (quiz.state === "completed" && quiz.latestResult)
    return quizAttemptRoute(quiz.latestResult.attemptId);
  if (quiz.state === "available") return publicQuizRoute(quiz.id);
  return null;
}

function firstName(fullName?: string | null): string {
  const value = fullName?.trim();
  return value ? (value.split(/\s+/).at(-1) ?? value) : "bạn";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
