"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Library,
  LogOut,
  Medal,
  UserRound,
  Plus,
  Sparkles,
  Snowflake,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/lib/auth-context";

type DashboardRole = UserRole.STUDENT | UserRole.TEACHER;

type Stat = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  color: string;
};

const studentStats: Stat[] = [
  {
    icon: Zap,
    label: "Tổng XP",
    value: "1.240",
    helper: "+120 tuần này",
    color: "bg-warning-soft",
  },
  {
    icon: Flame,
    label: "Chuỗi học",
    value: "5 ngày",
    helper: "Kỷ lục: 8 ngày",
    color: "bg-destructive-soft",
  },
  {
    icon: CheckCircle2,
    label: "Quiz hoàn thành",
    value: "18",
    helper: "Đúng trung bình 82%",
    color: "bg-success-soft",
  },
];

const teacherStats: Stat[] = [
  {
    icon: Users,
    label: "Học sinh",
    value: "86",
    helper: "Trong 3 lớp",
    color: "bg-secondary-soft",
  },
  {
    icon: Library,
    label: "Quiz đã tạo",
    value: "24",
    helper: "6 quiz tháng này",
    color: "bg-warning-soft",
  },
  {
    icon: BarChart3,
    label: "Tỉ lệ hoàn thành",
    value: "84%",
    helper: "+6% so với tuần trước",
    color: "bg-success-soft",
  },
];

export function DemoDashboard({ role }: { role: DashboardRole }) {
  const student = role === UserRole.STUDENT;
  const stats = student ? studentStats : teacherStats;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <DashboardHeader role={role} />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        {student ? <StudentAttendanceStreak /> : <TeacherWelcomeBanner />}

        <section
          aria-label="Tổng quan"
          className="mt-8 grid gap-5 sm:grid-cols-3"
        >
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article
                key={stat.label}
                className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-2 font-display text-3xl font-bold tabular-nums">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">
                      {stat.helper}
                    </p>
                  </div>
                  <span
                    className={
                      "flex h-12 w-12 items-center justify-center rounded-xl border-2 border-foreground shadow-brutal-sm " +
                      stat.color
                    }
                  >
                    <Icon
                      aria-hidden="true"
                      className="h-6 w-6"
                      strokeWidth={2.5}
                    />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        {student ? <StudentContent /> : <TeacherContent />}
      </main>
    </div>
  );
}

type StreakTheme = "energy" | "frost" | "galaxy";

const streakThemes: Record<
  StreakTheme,
  {
    label: string;
    icon: LucideIcon;
    panel: string;
    accent: string;
    soft: string;
    message: string;
  }
> = {
  energy: {
    label: "Năng lượng",
    icon: Flame,
    panel: "bg-warning-soft",
    accent: "bg-destructive",
    soft: "bg-primary",
    message: "Ngọn lửa đang rực cháy!",
  },
  frost: {
    label: "Băng giá",
    icon: Snowflake,
    panel: "bg-secondary-soft",
    accent: "bg-secondary",
    soft: "bg-surface",
    message: "Chuỗi học tập mát lạnh!",
  },
  galaxy: {
    label: "Ngân hà",
    icon: Sparkles,
    panel: "bg-purple-soft",
    accent: "bg-purple text-white",
    soft: "bg-secondary-soft",
    message: "Bạn đang bay qua dải ngân hà!",
  },
};

const attendanceDays = [
  { day: "T2", date: "07", state: "done" },
  { day: "T3", date: "08", state: "done" },
  { day: "T4", date: "09", state: "done" },
  { day: "T5", date: "10", state: "done" },
  { day: "T6", date: "11", state: "done" },
  { day: "T7", date: "12", state: "today" },
  { day: "CN", date: "13", state: "next" },
] as const;

function StudentAttendanceStreak() {
  const [themeName, setThemeName] = useState<StreakTheme>("energy");
  const [checkedIn, setCheckedIn] = useState(false);
  const theme = streakThemes[themeName];
  const ThemeIcon = theme.icon;

  return (
    <section
      aria-labelledby="attendance-title"
      className={`streak-panel relative overflow-hidden rounded-3xl border-[3px] border-foreground p-5 shadow-brutal-xl sm:p-7 ${theme.panel}`}
    >
      <div
        aria-hidden="true"
        className={`absolute -right-9 -top-10 h-32 w-32 rotate-12 rounded-[2rem] border-[3px] border-foreground opacity-80 ${theme.soft}`}
      />
      <div className="relative flex flex-col gap-6">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex items-center gap-4">
            <span
              className={`streak-icon flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[3px] border-foreground shadow-brutal-md ${theme.accent}`}
            >
              <ThemeIcon className="h-8 w-8" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-muted-foreground">
                ĐIỂM DANH HỌC TẬP
              </p>
              <h1
                id="attendance-title"
                className="font-display text-3xl font-bold sm:text-4xl"
              >
                7 ngày liên tiếp
              </h1>
              <p className="mt-1 font-semibold text-muted-foreground">
                {theme.message}
              </p>
            </div>
          </div>

          <div
            className="flex w-fit flex-wrap gap-2 rounded-2xl border-2 border-foreground bg-surface p-2 shadow-brutal-sm"
            aria-label="Chọn phong cách streak demo"
          >
            {(Object.keys(streakThemes) as StreakTheme[]).map((name) => {
              const option = streakThemes[name];
              const OptionIcon = option.icon;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setThemeName(name)}
                  aria-pressed={themeName === name}
                  className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${themeName === name ? "border-foreground bg-primary" : "border-transparent bg-surface hover:bg-surface-soft"}`}
                >
                  <OptionIcon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-3">
          {attendanceDays.map(({ day, date, state }) => {
            const completed =
              state === "done" || (state === "today" && checkedIn);
            const today = state === "today";
            return (
              <div
                key={day}
                className={`relative flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 border-foreground px-2 py-3 text-center shadow-brutal-sm ${completed ? theme.accent : today ? "bg-surface" : "bg-surface-soft text-muted-foreground"}`}
              >
                <span className="text-xs font-extrabold uppercase">{day}</span>
                <span className="mt-1 font-display text-2xl font-bold tabular-nums">
                  {date}
                </span>
                {completed ? (
                  <CheckCircle2
                    className="streak-check mt-1 h-5 w-5"
                    aria-label="Đã điểm danh"
                  />
                ) : today ? (
                  <span className="mt-1 text-[11px] font-extrabold">
                    HÔM NAY
                  </span>
                ) : (
                  <span className="mt-1 text-[11px] font-bold">Sắp tới</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="font-semibold text-muted-foreground">
            {checkedIn
              ? "Tuyệt vời! Bạn vừa nhận 10 XP điểm danh."
              : "Điểm danh hôm nay để giữ chuỗi và nhận 10 XP."}
          </p>
          <button
            type="button"
            disabled={checkedIn}
            onClick={() => setCheckedIn(true)}
            className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 font-bold shadow-brutal-md transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-default disabled:bg-success disabled:transform-none sm:w-auto"
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {checkedIn ? "Đã điểm danh" : "Điểm danh hôm nay"}
          </button>
        </div>
      </div>
    </section>
  );
}

function TeacherWelcomeBanner() {
  return (
    <section className="relative overflow-hidden rounded-3xl border-[3px] border-foreground bg-purple px-6 py-8 text-white shadow-brutal-xl sm:px-8 lg:px-10">
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-12 h-40 w-40 rounded-full border-[3px] border-foreground bg-primary"
      />
      <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-surface px-3 py-1.5 text-sm font-bold text-foreground shadow-brutal-sm">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Không gian lớp học
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold sm:text-4xl">
            Tạo lớp mới và mời học sinh cùng học trên ZuniBee.
          </h1>
          <p className="mt-3 max-w-2xl font-semibold leading-relaxed text-on-purple-muted">
            Chia sẻ bằng mã lớp, đường link, mã QR hoặc gửi lời mời qua email.
          </p>
        </div>
        <Link
          href={ROUTES.teacherCreateClassroom}
          className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 self-start rounded-xl border-2 border-foreground bg-primary px-6 font-bold text-on-primary shadow-brutal-lg transition-[transform,box-shadow,background-color] duration-200 hover:-translate-x-px hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-hover motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          Tạo lớp mới
        </Link>
      </div>
    </section>
  );
}

export function DashboardHeader({ role }: { role: DashboardRole }) {
  const student = role === UserRole.STUDENT;
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await logout();
    router.push(ROUTES.login);
  }

  const navItems = [
    {
      icon: LayoutDashboard,
      label: "Tổng quan",
      href: student ? ROUTES.studentDashboard : ROUTES.teacherDashboard,
    },
    {
      icon: student ? BookOpen : Users,
      label: student ? "Lớp của tôi" : "Lớp học",
      href: student ? ROUTES.studentClasses : ROUTES.teacherClasses,
    },
    {
      icon: student ? Medal : Library,
      label: student ? "Thành tích" : "Kho quiz",
      href: null,
    },
  ];

  return (
    <header className="border-b-2 border-foreground bg-surface px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link
          href={ROUTES.home}
          className="flex cursor-pointer items-center gap-2 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="hidden font-display text-xl font-bold sm:inline">
            ZuniBee
          </span>
        </Link>

        <nav
          aria-label="Điều hướng dashboard"
          className="hidden items-center gap-2 md:flex"
        >
          {navItems.map(({ icon: NavIcon, label, href }) =>
            href ? (
              <Link
                key={label}
                href={href}
                aria-current={
                  pathname === href ||
                  (href.endsWith("/classes") && pathname.startsWith(`${href}/`))
                    ? "page"
                    : undefined
                }
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors duration-200 hover:bg-surface-soft hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ${pathname === href || (href.endsWith("/classes") && pathname.startsWith(`${href}/`)) ? "bg-surface-soft text-foreground" : "text-muted-foreground"}`}
              >
                <NavIcon aria-hidden="true" className="h-4 w-4" />
                {label}
              </Link>
            ) : (
              <span
                key={label}
                aria-disabled="true"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground"
              >
                <NavIcon aria-hidden="true" className="h-4 w-4" />
                {label}
              </span>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Thông báo demo"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            <Bell aria-hidden="true" className="h-5 w-5" />
          </button>
          {user ? (
            <>
              <Link
                href={ROUTES.profile}
                aria-label="Hồ sơ cá nhân"
                title="Hồ sơ cá nhân"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
              >
                <UserRound aria-hidden="true" className="h-5 w-5" />
              </Link>
              <Link
                href={ROUTES.changePassword}
                aria-label="Đổi mật khẩu"
                title="Đổi mật khẩu"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
              >
                <KeyRound aria-hidden="true" className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-foreground bg-warning-soft px-3 font-bold shadow-brutal-sm transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
              >
                <LogOut aria-hidden="true" className="h-5 w-5" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </>
          ) : (
            <Link
              href={ROUTES.onboarding}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-foreground bg-warning-soft px-3 font-bold shadow-brutal-sm transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
            >
              {student ? (
                <BookOpen aria-hidden="true" className="h-5 w-5" />
              ) : (
                <GraduationCap aria-hidden="true" className="h-5 w-5" />
              )}
              <span className="hidden sm:inline">Đổi vai trò</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function StudentContent() {
  return (
    <div className="mt-8 grid gap-7 lg:grid-cols-[1.3fr_0.7fr]">
      <section id="thu-thach">
        <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-extrabold text-secondary-strong">
              GỢI Ý CHO BẠN
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              Tiếp tục học tập
            </h2>
          </div>
          <Link
            href={ROUTES.studentClasses}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 font-bold shadow-brutal-sm transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Tham gia lớp
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <LearningCard
            icon={BrainCircuit}
            color="bg-purple-soft"
            label="Khoa học · Lớp 8"
            title="Khám phá hệ Mặt Trời"
            progress={60}
            helper="3/5 câu"
          />
          <LearningCard
            icon={Trophy}
            color="bg-warning-soft"
            label="Thử thách hôm nay"
            title="10 câu Toán tư duy"
            progress={20}
            helper="+100 XP"
          />
        </div>

        <section className="mt-8">
          <h2 className="font-display text-2xl font-bold">Quiz được giao</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border-2 border-foreground bg-surface shadow-brutal-md">
            {[
              ["Tiếng Anh: Thì hiện tại hoàn thành", "Cô Lan", "Hạn thứ Sáu"],
              ["Lịch sử: Nhà Trần", "Cô Mai", "12 câu"],
            ].map(([title, teacher, meta], index) => (
              <div
                key={title}
                className="flex flex-col gap-3 border-b-2 border-divider p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground bg-secondary-soft">
                    <BookOpen aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {teacher} · {meta}
                    </p>
                  </div>
                </div>
                <span className="self-start rounded-full border-2 border-foreground bg-surface-soft px-3 py-1 text-sm font-bold sm:self-auto">
                  {index === 0 ? "Chưa làm" : "Đang làm"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <aside className="space-y-6">
        <DashboardSideCard
          icon={Flame}
          color="bg-destructive-soft"
          title="Giữ chuỗi học"
          description="Hoàn thành một quiz hôm nay để nối dài chuỗi 5 ngày."
        />
        <DashboardSideCard
          icon={Medal}
          color="bg-success-soft"
          title="Sắp mở khóa"
          description="Còn 60 XP để đạt huy hiệu Nhà thám hiểm kiến thức."
        />
      </aside>
    </div>
  );
}

function TeacherContent() {
  return (
    <div className="mt-8 grid gap-7 lg:grid-cols-[1.3fr_0.7fr]">
      <section id="quiz-gan-day">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold text-secondary-strong">
              HOẠT ĐỘNG GẦN ĐÂY
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              Quiz của cô
            </h2>
          </div>
          <span className="rounded-full border-2 border-foreground bg-warning-soft px-3 py-1 text-sm font-bold">
            Dữ liệu demo
          </span>
        </div>

        <div className="grid gap-5">
          {[
            {
              title: "Khám phá hệ Mặt Trời",
              className: "8A",
              completion: "28/32",
              score: "82%",
              color: "bg-purple-soft",
            },
            {
              title: "Ôn tập phản ứng hóa học",
              className: "8B",
              completion: "25/29",
              score: "76%",
              color: "bg-secondary-soft",
            },
            {
              title: "Sinh học: Hệ tuần hoàn",
              className: "8C",
              completion: "20/25",
              score: "88%",
              color: "bg-success-soft",
            },
          ].map((quiz) => (
            <article
              key={quiz.title}
              className="grid gap-4 rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <div className="flex items-center gap-3">
                <span
                  className={
                    "flex h-12 w-12 items-center justify-center rounded-xl border-2 border-foreground " +
                    quiz.color
                  }
                >
                  <Library aria-hidden="true" className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-bold">{quiz.title}</h3>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Lớp {quiz.className}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground">
                  HOÀN THÀNH
                </p>
                <p className="font-bold tabular-nums">{quiz.completion}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground">
                  ĐIỂM TB
                </p>
                <p className="font-bold tabular-nums">{quiz.score}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="space-y-6">
        <DashboardSideCard
          icon={Sparkles}
          color="bg-warning-soft"
          title="Tạo quiz với AI"
          description="Khu vực tạo quiz sẽ là bước tiếp theo khi backend và chức năng AI sẵn sàng."
        />
        <DashboardSideCard
          icon={BarChart3}
          color="bg-destructive-soft"
          title="Chủ đề cần chú ý"
          description="Lớp 8B đang gặp khó với cân bằng phương trình hóa học."
        />
        <DashboardSideCard
          icon={Clock}
          color="bg-secondary-soft"
          title="Lịch sắp tới"
          description="Quiz Khoa học lớp 8A kết thúc vào 17:00 thứ Sáu."
        />
      </aside>
    </div>
  );
}

function LearningCard({
  icon: Icon,
  color,
  label,
  title,
  progress,
  helper,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  title: string;
  progress: number;
  helper: string;
}) {
  return (
    <article className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md">
      <span
        className={
          "flex h-12 w-12 items-center justify-center rounded-xl border-2 border-foreground shadow-brutal-sm " +
          color
        }
      >
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <p className="mt-5 text-sm font-bold text-muted-foreground">{label}</p>
      <h3 className="mt-1 font-display text-xl font-bold">{title}</h3>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-foreground bg-surface-soft">
          <div
            className="h-full bg-success"
            style={{ width: progress + "%" }}
          />
        </div>
        <span className="text-sm font-bold tabular-nums">{progress}%</span>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
        {helper}
      </p>
    </article>
  );
}

function DashboardSideCard({
  icon: Icon,
  color,
  title,
  description,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md">
      <span
        className={
          "flex h-12 w-12 items-center justify-center rounded-xl border-2 border-foreground shadow-brutal-sm " +
          color
        }
      >
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 font-semibold leading-relaxed text-muted-foreground">
        {description}
      </p>
    </article>
  );
}
