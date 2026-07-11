import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  ChartNoAxesColumnIncreasing,
  Check,
  Clock,
  Flame,
  GraduationCap,
  Play,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/config/routes";
import { HomeAuthGate } from "@/components/home-auth-gate";

const buttonMotion =
  "transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-hover active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-xs motion-reduce:transform-none motion-reduce:transition-none";

const features: {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}[] = [
  {
    icon: BrainCircuit,
    title: "Học đúng nhịp riêng",
    description:
      "Học sinh luyện tập với câu hỏi vừa sức và nhận giải thích ngay sau mỗi lần trả lời.",
    color: "bg-purple-soft",
  },
  {
    icon: Sparkles,
    title: "Soạn quiz nhanh hơn",
    description:
      "Giáo viên biến nội dung bài học thành hoạt động tương tác chỉ trong vài bước.",
    color: "bg-warning-soft",
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    title: "Nhìn rõ tiến bộ",
    description:
      "Học sinh biết phần cần ôn; giáo viên nắm được chủ đề cả lớp đang cần hỗ trợ.",
    color: "bg-success-soft",
  },
];

const steps = [
  {
    number: "01",
    icon: Target,
    title: "Chọn vai trò và mục tiêu",
    description: "Bắt đầu với môn học, chủ đề hoặc lớp học bạn đang quan tâm.",
    color: "bg-secondary",
  },
  {
    number: "02",
    icon: Play,
    title: "Tạo hoặc làm quiz",
    description:
      "Giáo viên chuẩn bị hoạt động; học sinh tham gia và nhận phản hồi ngay.",
    color: "bg-primary",
  },
  {
    number: "03",
    icon: Star,
    title: "Cùng nhìn thấy tiến bộ",
    description:
      "Theo dõi kết quả, củng cố điểm yếu và ghi nhận từng bước tiến.",
    color: "bg-success",
  },
];

export default function Home() {
  return (
    <HomeAuthGate>
      <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
        <Header />

        <main>
          <section className="relative px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28">
            <div
              aria-hidden="true"
              className="absolute -left-14 top-32 h-36 w-36 rounded-full border-2 border-foreground bg-purple-soft"
            />
            <div
              aria-hidden="true"
              className="absolute -right-12 bottom-14 h-28 w-28 rotate-12 rounded-3xl border-2 border-foreground bg-destructive"
            />

            <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
              <div className="home-hero-copy text-center lg:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-secondary-soft px-4 py-2 text-sm font-extrabold shadow-brutal-sm">
                  <Users aria-hidden="true" className="h-4 w-4" />
                  Dành cho học sinh và giáo viên
                </div>

                <h1 className="mt-7 font-display text-[2.6rem] font-bold leading-[1.08] tracking-[-0.04em] sm:text-6xl lg:text-[4.25rem]">
                  Mỗi câu hỏi mở lối cho một giờ học{" "}
                  <span className="relative inline-block whitespace-nowrap text-secondary-strong">
                    hay hơn
                    <svg
                      aria-hidden="true"
                      className="absolute -bottom-2 left-0 h-3 w-full text-primary"
                      viewBox="0 0 220 12"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M4 8C55 2 144 3 216 7"
                        stroke="currentColor"
                        strokeWidth="7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </h1>

                <p className="mx-auto mt-7 max-w-2xl text-lg font-semibold leading-relaxed text-muted-foreground sm:text-xl lg:mx-0">
                  Học sinh luyện tập theo nhịp riêng. Giáo viên tạo quiz sinh
                  động, theo dõi tiến bộ và giúp cả lớp hiểu bài sâu hơn.
                </p>

                <div className="mt-9 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center lg:justify-start">
                  <Link
                    href={ROUTES.register}
                    className={
                      buttonMotion +
                      " group inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-7 text-lg font-extrabold shadow-brutal-lg hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    }
                  >
                    Bắt đầu với ZuniBee
                    <ArrowRight
                      aria-hidden="true"
                      className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                      strokeWidth={2.7}
                    />
                  </Link>
                  <Link
                    href="#cach-hoc"
                    className={
                      buttonMotion +
                      " inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-7 text-lg font-extrabold shadow-brutal-lg hover:bg-surface-soft focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    }
                  >
                    <Play
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="currentColor"
                    />
                    Khám phá cách hoạt động
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-bold text-muted-foreground lg:justify-start">
                  {["Học theo nhịp riêng", "Tạo hoạt động trong vài phút"].map(
                    (label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-2"
                      >
                        <Check
                          aria-hidden="true"
                          className="h-5 w-5 rounded-full border-2 border-foreground bg-success p-0.5 text-foreground"
                          strokeWidth={3}
                        />
                        {label}
                      </span>
                    ),
                  )}
                </div>
              </div>

              <QuizPreview />
            </div>
          </section>

          <section
            aria-label="Lợi ích nổi bật"
            className="border-y-[3px] border-foreground bg-banner px-4 py-5 text-white sm:px-6 lg:px-8"
          >
            <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-3 sm:divide-x sm:divide-white/30">
              <Benefit icon={BrainCircuit} color="text-primary">
                Cá nhân hóa theo năng lực
              </Benefit>
              <Benefit icon={Sparkles} color="text-secondary">
                Tạo quiz nhanh cùng AI
              </Benefit>
              <Benefit icon={Trophy} color="text-success">
                Theo dõi tiến bộ rõ ràng
              </Benefit>
            </div>
          </section>

          <Features />
          <HowItWorks />
          <FinalCta />
        </main>

        <Footer />
      </div>
    </HomeAuthGate>
  );
}

function Header() {
  return (
    <header className="relative z-30 px-4 pt-4 sm:px-6 lg:px-8">
      <nav
        aria-label="Điều hướng chính"
        className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 rounded-2xl border-2 border-foreground bg-surface px-4 py-3 shadow-brutal-lg sm:px-5"
      >
        <Brand />

        <div className="hidden items-center gap-7 text-sm font-bold md:flex">
          {[
            ["#tinh-nang", "Tính năng"],
            ["#cach-hoc", "Cách học"],
            ["#ve-zunibee", "Về ZuniBee"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="cursor-pointer rounded-md transition-colors duration-200 hover:text-secondary-strong focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={ROUTES.login}
            className="hidden min-h-11 cursor-pointer items-center justify-center rounded-xl px-3 font-bold transition-colors duration-200 hover:bg-surface-soft focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring sm:inline-flex"
          >
            Đăng nhập
          </Link>
          <Link
            href={ROUTES.register}
            className={
              buttonMotion +
              " inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-primary px-4 font-bold shadow-brutal-md hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
            }
          >
            Bắt đầu học
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Brand() {
  return (
    <Link
      href={ROUTES.home}
      aria-label="ZuniBee — Trang chủ"
      className="flex cursor-pointer items-center gap-2 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <span className="flex h-10 w-10 rotate-[-3deg] items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
        <Sparkles aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
      </span>
      <span className="font-display text-xl font-bold tracking-tight sm:text-2xl">
        Zuni<span className="text-secondary-strong">Bee</span>
      </span>
    </Link>
  );
}

function QuizPreview() {
  const answers = [
    ["A", "Sao Kim"],
    ["B", "Sao Hỏa"],
    ["C", "Sao Mộc"],
    ["D", "Sao Thổ"],
  ];

  return (
    <div className="home-quiz-preview relative mx-auto w-full max-w-xl lg:mx-0">
      <div
        aria-hidden="true"
        className="absolute -left-4 -top-5 z-10 rotate-[-5deg] rounded-xl border-2 border-foreground bg-primary px-4 py-2 font-display text-sm font-bold shadow-brutal-md sm:-left-8"
      >
        Quiz mẫu cho lớp học
      </div>
      <div className="rounded-[1.75rem] border-[3px] border-foreground bg-surface p-5 shadow-brutal-2xl sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold text-muted-foreground">
              Khoa học · Lớp 8
            </p>
            <p className="mt-1 font-display text-xl font-bold">
              Khám phá hệ Mặt Trời
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-purple-soft shadow-brutal-sm">
            <Sparkles
              aria-hidden="true"
              className="h-6 w-6 text-purple"
              strokeWidth={2.7}
            />
          </span>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-foreground bg-surface-soft">
            <div className="home-progress-fill h-full w-[60%] bg-success" />
          </div>
          <span className="text-sm font-extrabold tabular-nums">3/5 câu</span>
        </div>

        <div className="mt-7 rounded-2xl border-2 border-foreground bg-background p-4 sm:p-5">
          <p className="text-sm font-extrabold text-secondary-strong">CÂU 4</p>
          <p className="mt-2 text-lg font-extrabold leading-snug sm:text-xl">
            Hành tinh nào được gọi là “Hành tinh Đỏ”?
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {answers.map(([key, answer], index) => (
            <div
              key={key}
              className={
                "flex min-h-14 items-center gap-3 rounded-xl border-2 border-foreground px-3 py-2 font-bold shadow-brutal-md " +
                (index === 1 ? "bg-success-soft" : "bg-surface")
              }
            >
              <span
                className={
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-foreground text-sm " +
                  (index === 1 ? "bg-success" : "bg-surface-soft")
                }
              >
                {index === 1 ? (
                  <Check
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth={3}
                  />
                ) : (
                  key
                )}
              </span>
              {answer}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-divider pt-5">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-warning-soft px-3 py-1.5 text-sm font-extrabold shadow-brutal-sm">
            <Zap aria-hidden="true" className="h-4 w-4" fill="currentColor" />
            +20 XP
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-muted-foreground">
            <Clock aria-hidden="true" className="h-4 w-4" />
            Khoảng 5 phút
          </span>
        </div>
      </div>

      <div className="absolute -bottom-8 -right-3 flex rotate-3 items-center gap-2 rounded-xl border-2 border-foreground bg-destructive px-3 py-2 font-extrabold shadow-brutal-md sm:-right-7">
        <Flame aria-hidden="true" className="h-5 w-5" fill="var(--primary)" />
        Chuỗi 5 ngày
      </div>
    </div>
  );
}

function Benefit({
  icon: Icon,
  color,
  children,
}: {
  icon: LucideIcon;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-2 text-center font-bold">
      <Icon aria-hidden="true" className={"h-6 w-6 " + color} />
      {children}
    </div>
  );
}

function Features() {
  return (
    <section
      id="tinh-nang"
      className="scroll-mt-8 px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold tracking-wider text-secondary-strong">
            HỌC THÔNG MINH HƠN
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Một không gian học tập tốt hơn cho cả lớp
          </h2>
          <p className="mt-5 text-lg font-semibold leading-relaxed text-muted-foreground">
            Học sinh có trải nghiệm vừa sức, giáo viên có công cụ nhanh gọn để
            biến bài giảng thành hoạt động tương tác.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className={
                  "rounded-2xl border-2 border-foreground p-6 shadow-[5px_5px_0_var(--shadow-color)] " +
                  feature.color
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm">
                    <Icon
                      aria-hidden="true"
                      className="h-7 w-7"
                      strokeWidth={2.5}
                    />
                  </span>
                  <span className="font-display text-sm font-bold tabular-nums text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-bold">
                  {feature.title}
                </h3>
                <p className="mt-3 font-semibold leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      id="cach-hoc"
      className="scroll-mt-8 border-y-[3px] border-foreground bg-section px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-surface px-4 py-2 text-sm font-extrabold shadow-brutal-sm">
            <GraduationCap aria-hidden="true" className="h-5 w-5" />3 bước thật
            đơn giản
          </div>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Dạy nhẹ nhàng hơn, học chủ động hơn
          </h2>
          <p className="mt-5 max-w-xl text-lg font-semibold leading-relaxed text-muted-foreground">
            ZuniBee kết nối mục tiêu của giáo viên với nhịp học của từng học
            sinh qua những chặng quiz ngắn và rõ ràng.
          </p>
          <Link
            href={ROUTES.register}
            className={
              buttonMotion +
              " group mt-8 inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 text-lg font-extrabold shadow-brutal-lg hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
            }
          >
            Bắt đầu hành trình của bạn
            <ArrowRight
              aria-hidden="true"
              className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
            />
          </Link>
        </div>

        <ol className="grid gap-5">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.number}
                className="grid gap-5 rounded-2xl border-2 border-foreground bg-surface p-5 shadow-[5px_5px_0_var(--shadow-color)] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6"
              >
                <span
                  className={
                    "flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground shadow-brutal-sm " +
                    step.color
                  }
                >
                  <Icon
                    aria-hidden="true"
                    className="h-8 w-8"
                    strokeWidth={2.5}
                  />
                </span>
                <div>
                  <h3 className="font-display text-2xl font-bold">
                    {step.title}
                  </h3>
                  <p className="mt-1 font-semibold leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                <span className="font-display text-3xl font-bold tabular-nums text-divider sm:text-4xl">
                  {step.number}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section
      id="ve-zunibee"
      className="scroll-mt-8 px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border-[3px] border-foreground bg-purple px-6 py-12 text-center text-white shadow-brutal-2xl sm:px-10 sm:py-16">
        <div
          aria-hidden="true"
          className="absolute -left-10 -top-10 h-32 w-32 rounded-full border-[3px] border-foreground bg-primary"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-9 -right-7 h-28 w-28 rotate-12 rounded-3xl border-[3px] border-foreground bg-success"
        />
        <div className="relative">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-primary text-foreground shadow-brutal-md">
            <Sparkles
              aria-hidden="true"
              className="h-8 w-8"
              strokeWidth={2.5}
            />
          </span>
          <h2 className="mx-auto mt-6 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Sẵn sàng làm cho giờ học tiếp theo sinh động hơn?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-on-purple-muted">
            Dù bạn đang học hay đang dạy, ZuniBee giúp mỗi câu hỏi trở thành một
            cơ hội hiểu bài và tiến bộ.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href={ROUTES.register}
              className={
                buttonMotion +
                " group inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-7 text-lg font-extrabold text-foreground shadow-brutal-lg hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
              }
            >
              Đăng ký miễn phí
              <ArrowRight
                aria-hidden="true"
                className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
              />
            </Link>
            <Link
              href={ROUTES.login}
              className={
                buttonMotion +
                " inline-flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface px-7 text-lg font-extrabold text-foreground shadow-brutal-lg hover:bg-surface-soft focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
              }
            >
              Tôi đã có tài khoản
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t-[3px] border-foreground bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
        <Brand />
        <p className="text-sm font-semibold text-muted-foreground">
          Học chủ động, dạy sinh động, tiến bộ mỗi ngày.
        </p>
        <div className="flex items-center gap-5 text-sm font-bold">
          <Link
            href={ROUTES.login}
            className="cursor-pointer rounded-md hover:text-secondary-strong focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Đăng nhập
          </Link>
          <Link
            href={ROUTES.register}
            className="cursor-pointer rounded-md hover:text-secondary-strong focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Đăng ký
          </Link>
        </div>
      </div>
    </footer>
  );
}
