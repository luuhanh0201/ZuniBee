"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Plus,
  Sparkles,
  Target,
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
        <section className="relative overflow-hidden rounded-3xl border-[3px] border-foreground bg-purple px-6 py-8 text-white shadow-brutal-xl sm:px-8 lg:px-10">
          <div
            aria-hidden="true"
            className="absolute -right-8 -top-12 h-40 w-40 rounded-full border-[3px] border-foreground bg-primary"
          />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-surface px-3 py-1.5 text-sm font-bold text-foreground shadow-brutal-sm">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                Dashboard {student ? "học sinh" : "giáo viên"} · Demo
              </span>
              <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold sm:text-4xl">
                {student
                  ? "Chào Minh! Hôm nay mình tiến thêm một bước nhé."
                  : "Chào cô Mai! Lớp học hôm nay đang chờ một hoạt động thú vị."}
              </h1>
              <p className="mt-3 max-w-2xl font-semibold leading-relaxed text-on-purple-muted">
                {student
                  ? "Tiếp tục hành trình Khoa học hoặc thử thách bản thân với quiz mới."
                  : "Tạo quiz, xem kết quả gần đây và tìm chủ đề học sinh cần hỗ trợ."}
              </p>
            </div>
            <Link
              href={student ? "#thu-thach" : "#quiz-gan-day"}
              className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 self-start rounded-xl border-2 border-foreground bg-primary px-6 font-bold text-on-primary shadow-brutal-lg transition-[transform,box-shadow,background-color] duration-200 hover:-translate-x-px hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-hover motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {student ? (
                <>
                  <Target aria-hidden="true" className="h-5 w-5" />
                  Làm thử thách
                </>
              ) : (
                <>
                  <Plus aria-hidden="true" className="h-5 w-5" />
                  Xem khu vực tạo quiz
                </>
              )}
            </Link>
          </div>
        </section>

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

function DashboardHeader({ role }: { role: DashboardRole }) {
  const student = role === UserRole.STUDENT;
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push(ROUTES.login);
  }

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
          {[
            [LayoutDashboard, "Tổng quan"],
            [student ? BookOpen : Users, student ? "Học tập" : "Lớp học"],
            [student ? Medal : Library, student ? "Thành tích" : "Kho quiz"],
          ].map(([Icon, label]) => {
            const NavIcon = Icon as LucideIcon;
            return (
              <span
                key={label as string}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground first:bg-surface-soft first:text-foreground"
              >
                <NavIcon aria-hidden="true" className="h-4 w-4" />
                {label as string}
              </span>
            );
          })}
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
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold text-secondary-strong">
              GỢI Ý CHO BẠN
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              Tiếp tục học tập
            </h2>
          </div>
          <span className="text-sm font-bold text-muted-foreground">
            2 hoạt động
          </span>
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
