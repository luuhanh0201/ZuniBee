import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  Play,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/config/routes";
import { HomeAuthGate } from "@/components/home-auth-gate";
import { BrandLockup } from "@/components/ui/brand-lockup";

const primaryAction =
  "group inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 py-3 font-semibold text-on-primary shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-md active:translate-y-0 active:shadow-brutal-xs motion-reduce:transform-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring";

const secondaryAction =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-5 py-3 font-semibold shadow-brutal-xs transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-surface-soft hover:shadow-brutal-sm active:translate-y-0 active:shadow-none motion-reduce:transform-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring";

const learningSteps: Array<{
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    number: "01",
    icon: FileText,
    title: "Bắt đầu từ nguồn thật",
    description:
      "Đưa tài liệu và nội dung lớp học vào một không gian có cấu trúc.",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "AI dựng bản nháp",
    description:
      "Tạo hoạt động phù hợp ngữ cảnh để giáo viên kiểm tra và điều chỉnh.",
  },
  {
    number: "03",
    icon: BrainCircuit,
    title: "Học, làm và nhận phản hồi",
    description:
      "Người học đi qua từng hoạt động ngắn, rõ mục tiêu và biết bước tiếp theo.",
  },
  {
    number: "04",
    icon: Target,
    title: "Nhìn lại để tiến bộ",
    description:
      "Kết quả trở thành tín hiệu cho lần học và lần hướng dẫn tiếp theo.",
  },
];

export default function Home() {
  return (
    <HomeAuthGate>
      <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
        <a href="#main-content" className="skip-link">
          Bỏ qua điều hướng
        </a>
        <Header />
        <main id="main-content">
          <Hero />
          <LearningLoop />
          <RoleExperience />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </HomeAuthGate>
  );
}

function Header() {
  return (
    <header className="px-4 pt-4 sm:px-6 lg:px-8">
      <nav
        aria-label="Điều hướng chính"
        className="motion-enter mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 rounded-2xl border border-divider bg-surface px-4 py-3 sm:px-5"
      >
        <BrandLockup />
        <div className="hidden items-center gap-1 rounded-xl bg-surface-soft p-1 text-sm font-semibold md:flex">
          {[
            ["#khac-biet", "Vì sao khác"],
            ["#hanh-trinh", "Hành trình học"],
            ["#vai-tro", "Dành cho ai"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="cursor-pointer rounded-lg px-4 py-2 transition-colors duration-200 hover:bg-surface hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={ROUTES.login}
            className="hidden min-h-11 cursor-pointer items-center rounded-xl px-3 font-semibold text-muted-foreground transition-colors duration-200 hover:bg-surface-soft hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline-flex"
          >
            Đăng nhập
          </Link>
          <Link href={ROUTES.register} className={primaryAction}>
            Bắt đầu học
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="khac-biet"
      className="scroll-mt-8 px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16">
        <div className="home-hero-copy">
          <p className="editorial-label flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
            AI Learning Workspace
          </p>
          <h1 className="mt-5 max-w-4xl font-display text-[2.75rem] font-bold leading-[1.06] tracking-[-0.045em] sm:text-6xl lg:text-[4.35rem]">
            Tài liệu không chỉ để đọc.{" "}
            <span className="relative inline-block">
              Nó có thể trở thành một hành trình học.
              <svg
                aria-hidden="true"
                className="home-hero-underline absolute -bottom-2 left-0 h-3 w-full text-primary"
                viewBox="0 0 560 12"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M4 8C128 2 376 3 556 7"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            ZuniBee giúp giáo viên biến nội dung thành hoạt động có cấu trúc và
            giúp người học luôn biết mình nên học gì tiếp theo.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={ROUTES.register} className={primaryAction}>
              Bắt đầu với ZuniBee
              <ArrowRight
                className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </Link>
            <Link href="#hanh-trinh" className={secondaryAction}>
              <Play className="h-5 w-5" aria-hidden="true" />
              Xem cách hoạt động
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-muted-foreground">
            {["Học theo mạch rõ ràng", "AI hỗ trợ đúng ngữ cảnh"].map(
              (label) => (
                <span key={label} className="inline-flex items-center gap-2">
                  <Check
                    className="h-5 w-5 rounded-full bg-success-soft p-1 text-foreground"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                  {label}
                </span>
              ),
            )}
          </div>
        </div>
        <StudyWorkspacePreview />
      </div>
    </section>
  );
}

function StudyWorkspacePreview() {
  return (
    <div className="home-quiz-preview relative mx-auto w-full max-w-xl lg:mx-0">
      <div className="motion-pop motion-delay-2 absolute -left-3 top-14 hidden w-36 -rotate-3 rounded-xl border-2 border-foreground bg-primary p-3 text-sm font-semibold shadow-brutal-sm sm:block">
        <Zap className="mb-2 h-5 w-5" aria-hidden="true" />8 phút cho phiên hôm
        nay
      </div>
      <div className="overflow-hidden rounded-[1.75rem] border-2 border-foreground bg-surface shadow-brutal-lg">
        <div className="flex items-center justify-between gap-4 border-b border-divider px-5 py-4 sm:px-7">
          <div>
            <p className="editorial-label">Không gian học</p>
            <p className="mt-1 font-display text-xl font-semibold">
              English Collocations
            </p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-soft text-purple">
            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <div className="grid sm:grid-cols-[0.37fr_0.63fr]">
          <aside className="border-b border-divider bg-surface-soft p-5 sm:border-b-0 sm:border-r">
            <p className="editorial-label">Module 02</p>
            <ol className="mt-4 space-y-2 text-sm">
              {[
                ["01", "Khám phá", true],
                ["02", "Luyện tập", true],
                ["03", "Vận dụng", false],
                ["04", "Ôn lại", false],
              ].map(([number, label, done]) => (
                <li
                  key={String(number)}
                  className={
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 " +
                    (label === "Vận dụng"
                      ? "bg-primary font-semibold text-on-primary"
                      : "text-muted-foreground")
                  }
                >
                  <span className="text-xs tabular-nums">{String(number)}</span>
                  <span>{String(label)}</span>
                  {done ? (
                    <Check
                      className="ml-auto h-4 w-4"
                      strokeWidth={3}
                      aria-label="Đã hoàn thành"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </aside>
          <div className="p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-divider bg-surface-soft px-3 py-1 text-xs font-semibold">
                Hoạt động 3/4
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />5 phút
              </span>
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold">
              Chọn cách dùng tự nhiên nhất
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Hoàn thành câu trong ngữ cảnh, sau đó xem lý do của lựa chọn.
            </p>
            <div className="mt-6 space-y-3">
              {["make a decision", "do a decision", "take a decision"].map(
                (answer, index) => (
                  <div
                    key={answer}
                    className={
                      "flex items-center gap-3 rounded-xl border p-3 text-sm font-medium " +
                      (index === 0
                        ? "border-foreground bg-success-soft"
                        : "border-divider bg-surface")
                    }
                  >
                    <span
                      className={
                        "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold " +
                        (index === 0 ? "bg-success" : "bg-surface-soft")
                      }
                    >
                      {index === 0 ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        String.fromCharCode(65 + index)
                      )}
                    </span>
                    {answer}
                  </div>
                ),
              )}
            </div>
            <p className="mt-6 flex items-start gap-2 border-t border-divider pt-5 text-sm text-muted-foreground">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-purple"
                aria-hidden="true"
              />
              AI giải thích ngay trong hoạt động, không kéo bạn sang một cửa sổ
              chat khác.
            </p>
          </div>
        </div>
      </div>
      <div className="motion-pop motion-delay-3 absolute -bottom-5 right-4 flex rotate-2 items-center gap-2 rounded-xl border-2 border-foreground bg-surface px-3 py-2 text-sm font-semibold shadow-brutal-sm sm:-right-5">
        <Target className="h-4 w-4 text-secondary-strong" aria-hidden="true" />
        Bước tiếp theo đã sẵn sàng
      </div>
    </div>
  );
}

function LearningLoop() {
  return (
    <section
      id="hanh-trinh"
      className="scroll-mt-8 border-y border-divider bg-surface px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <div className="motion-scroll-reveal lg:sticky lg:top-8 lg:self-start">
          <p className="editorial-label">Một mạch học liên tục</p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-5xl">
            Từ nguồn kiến thức đến bước tiến tiếp theo.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Quiz không phải đích đến. Mỗi hoạt động là một phần của hành trình
            học, thực hành, phản hồi và ôn lại.
          </p>
          <Link href={ROUTES.register} className={primaryAction + " mt-7"}>
            Tạo hành trình đầu tiên
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        <ol className="motion-scroll-stagger relative border-l-2 border-divider pl-6 sm:pl-10">
          {learningSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.number}
                className="relative border-b border-divider py-7 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span
                  aria-hidden="true"
                  className={
                    "absolute -left-[2.1rem] top-9 h-4 w-4 rounded-full border-2 border-foreground sm:-left-[2.95rem] " +
                    (index === 1 ? "bg-primary" : "bg-surface")
                  }
                />
                <div className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-soft text-secondary-strong">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="editorial-label">Bước {step.number}</p>
                    <h3 className="mt-1 font-display text-2xl font-semibold">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  <span className="hidden font-display text-3xl font-bold text-divider sm:block">
                    {step.number}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function RoleExperience() {
  return (
    <section
      id="vai-tro"
      className="scroll-mt-8 px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="motion-scroll-reveal max-w-3xl">
          <p className="editorial-label">Hai vai trò, một hành trình</p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-5xl">
            Giáo viên giữ quyền quyết định. Người học luôn thấy bước tiếp theo.
          </h2>
        </div>
        <div className="motion-scroll-stagger mt-12 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <RoleCard
            icon={GraduationCap}
            label="Không gian giáo viên"
            title="Tạo nhanh hơn, nhưng vẫn kiểm soát nội dung."
            description="Tổ chức tài liệu, dùng AI để tạo bản nháp, chỉnh sửa và đưa hoạt động đến đúng lớp học."
            bullets={[
              "AI xuất hiện ngay trong luồng tạo nội dung",
              "Lớp học, tài liệu và hoạt động được nối liền",
              "Kết quả giúp xác định phần cần hỗ trợ",
            ]}
            actionLabel="Bắt đầu với vai trò giáo viên"
          />
          <RoleCard
            icon={BookOpen}
            label="Không gian người học"
            title="Mở ZuniBee và biết hôm nay cần làm gì."
            description="Tiếp tục hoạt động gần nhất, hoàn thành phần được giao và xem phản hồi trong cùng một mạch học."
            bullets={[
              "Phiên học ngắn và rõ một mục tiêu",
              "Phản hồi xuất hiện đúng thời điểm",
              "Tiến bộ được gắn với hoạt động thật",
            ]}
            actionLabel="Bắt đầu học"
            muted
          />
        </div>
      </div>
    </section>
  );
}

function RoleCard({
  icon: Icon,
  label,
  title,
  description,
  bullets,
  actionLabel,
  muted = false,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  actionLabel: string;
  muted?: boolean;
}) {
  return (
    <article
      className={
        "motion-lift flex min-h-full flex-col rounded-3xl border-2 border-foreground p-6 shadow-brutal-sm sm:p-8 " +
        (muted ? "bg-surface" : "bg-surface-soft")
      }
    >
      <div className="flex items-center gap-3">
        <span
          className={
            "flex h-12 w-12 items-center justify-center rounded-xl " +
            (muted
              ? "bg-secondary-soft text-secondary-strong"
              : "bg-primary text-on-primary")
          }
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="editorial-label">{label}</p>
      </div>
      <h3 className="mt-7 max-w-2xl font-display text-2xl font-bold sm:text-3xl">
        {title}
      </h3>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
        {description}
      </p>
      <ul className="mt-6 space-y-3">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex items-start gap-3 text-sm font-medium"
          >
            <Check
              className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-success-soft p-1"
              strokeWidth={3}
              aria-hidden="true"
            />
            {bullet}
          </li>
        ))}
      </ul>
      <Link
        href={ROUTES.register}
        className={
          "group mt-8 inline-flex min-h-12 cursor-pointer items-center gap-2 self-start rounded-xl font-semibold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring " +
          (muted
            ? "text-secondary-strong"
            : "border-2 border-foreground bg-primary px-5 text-on-primary shadow-brutal-sm")
        }
      >
        {actionLabel}
        <ChevronRight
          className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
          aria-hidden="true"
        />
      </Link>
    </article>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
      <div className="motion-scroll-reveal mx-auto grid max-w-7xl overflow-hidden rounded-3xl border-2 border-foreground bg-banner text-white shadow-brutal-lg lg:grid-cols-[1fr_auto]">
        <div className="p-7 sm:p-10 lg:p-12">
          <p className="editorial-label text-primary">
            Bắt đầu từ điều bạn đang có
          </p>
          <h2 className="mt-3 max-w-4xl font-display text-3xl font-bold sm:text-5xl">
            Tài liệu tiếp theo của bạn có thể trở thành một phiên học thật sự.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-white/75">
            Tạo tài khoản, chọn vai trò và xây không gian học phù hợp với bạn.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 border-t border-white/20 bg-white/5 p-7 lg:min-w-72 lg:border-l lg:border-t-0 lg:p-10">
          <Link href={ROUTES.register} className={primaryAction}>
            Đăng ký miễn phí
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            href={ROUTES.login}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-white/40 px-5 font-semibold text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary"
          >
            Tôi đã có tài khoản
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-divider bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
        <BrandLockup />
        <p className="text-sm text-muted-foreground">
          Biến tài liệu thành một hành trình học có cấu trúc.
        </p>
        <div className="flex items-center gap-5 text-sm font-semibold">
          <Link
            href={ROUTES.login}
            className="cursor-pointer rounded-md transition-colors hover:text-secondary-strong focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            Đăng nhập
          </Link>
          <Link
            href={ROUTES.register}
            className="cursor-pointer rounded-md transition-colors hover:text-secondary-strong focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            Đăng ký
          </Link>
        </div>
      </div>
    </footer>
  );
}
