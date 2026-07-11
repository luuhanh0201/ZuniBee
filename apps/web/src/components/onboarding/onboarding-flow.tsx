"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { ROUTES } from "@/config/routes";

type DemoRole = UserRole.STUDENT | UserRole.TEACHER;

const ROLE_STORAGE_KEY = "zunibee-demo-role";
const PROFILE_STORAGE_KEY = "zunibee-demo-profile";

const roleOptions: {
  value: DemoRole;
  icon: typeof BookOpen;
  title: string;
  description: string;
  color: string;
}[] = [
  {
    value: UserRole.STUDENT,
    icon: BookOpen,
    title: "Học sinh",
    description: "Luyện quiz, theo dõi XP và học theo nhịp riêng.",
    color: "bg-secondary-soft",
  },
  {
    value: UserRole.TEACHER,
    icon: GraduationCap,
    title: "Giáo viên",
    description: "Tạo hoạt động, quản lý lớp và xem tiến bộ học sinh.",
    color: "bg-warning-soft",
  },
];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<DemoRole | null>(null);
  const [level, setLevel] = useState("Lớp 8");
  const [subject, setSubject] = useState("Khoa học");

  function finish(skipProfile = false) {
    if (!role) return;

    localStorage.setItem(ROLE_STORAGE_KEY, role);
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        role,
        level: skipProfile ? null : level,
        subject: skipProfile ? null : subject,
      }),
    );

    router.push(
      role === UserRole.STUDENT
        ? ROUTES.studentDashboard
        : ROUTES.teacherDashboard,
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground sm:px-6">
      <div
        aria-hidden="true"
        className="absolute -left-12 top-16 h-32 w-32 rounded-full border-2 border-foreground bg-secondary"
      />
      <div
        aria-hidden="true"
        className="absolute -right-10 bottom-12 h-28 w-28 rotate-12 rounded-3xl border-2 border-foreground bg-success"
      />

      <section className="relative z-10 w-full max-w-3xl rounded-3xl border-[3px] border-foreground bg-surface p-5 shadow-brutal-2xl sm:p-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg font-bold">
                Thiết lập ZuniBee
              </p>
              <p className="text-sm font-semibold text-muted-foreground">
                Bản demo · không cần backend
              </p>
            </div>
          </div>
          <span className="rounded-full border-2 border-foreground bg-surface-soft px-3 py-1 text-sm font-bold tabular-nums">
            Bước {step}/2
          </span>
        </header>

        <div className="mt-6 h-3 overflow-hidden rounded-full border-2 border-foreground bg-surface-soft">
          <div
            className={
              "h-full bg-success transition-[width] duration-300 motion-reduce:transition-none " +
              (step === 1 ? "w-1/2" : "w-full")
            }
          />
        </div>

        {step === 1 ? (
          <div className="mt-8">
            <div className="text-center">
              <h1 className="font-display text-3xl font-bold sm:text-4xl">
                Bạn muốn trải nghiệm ZuniBee với vai trò nào?
              </h1>
              <p className="mt-3 font-semibold text-muted-foreground">
                Bạn có thể đổi lại vai trò bất cứ lúc nào trong bản demo.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Chọn vai trò demo"
              className="mt-8 grid gap-4 sm:grid-cols-2"
            >
              {roleOptions.map((option) => {
                const Icon = option.icon;
                const selected = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRole(option.value)}
                    className={
                      "relative min-h-48 cursor-pointer rounded-2xl border-[3px] border-foreground p-5 text-left transition-[transform,box-shadow,background-color] duration-200 ease-out focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transform-none " +
                      (selected
                        ? option.color +
                          " -translate-x-px -translate-y-px shadow-brutal-lg"
                        : "bg-surface shadow-brutal-sm hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md")
                    }
                  >
                    {selected ? (
                      <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-foreground bg-success">
                        <Check
                          aria-hidden="true"
                          className="h-4 w-4"
                          strokeWidth={3}
                        />
                      </span>
                    ) : null}
                    <span
                      className={
                        "flex h-14 w-14 items-center justify-center rounded-xl border-2 border-foreground shadow-brutal-sm " +
                        option.color
                      }
                    >
                      <Icon
                        aria-hidden="true"
                        className="h-7 w-7"
                        strokeWidth={2.5}
                      />
                    </span>
                    <h2 className="mt-5 font-display text-2xl font-bold">
                      {option.title}
                    </h2>
                    <p className="mt-2 font-semibold leading-relaxed text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!role}
              onClick={() => setStep(2)}
              className="mt-7 inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 text-lg font-bold text-on-primary shadow-brutal-md transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-xs disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-soft disabled:text-muted-foreground disabled:shadow-none disabled:transform-none motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Tiếp tục
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="text-center">
              <h1 className="font-display text-3xl font-bold sm:text-4xl">
                Cá nhân hóa trải nghiệm demo
              </h1>
              <p className="mt-3 font-semibold text-muted-foreground">
                {role === UserRole.STUDENT
                  ? "Chọn lớp và môn bạn muốn luyện tập trước."
                  : "Chọn khối lớp và môn bạn đang giảng dạy."}
              </p>
            </div>

            <div className="mx-auto mt-8 grid max-w-xl gap-5 sm:grid-cols-2">
              <label className="font-bold">
                {role === UserRole.STUDENT
                  ? "Bạn đang học"
                  : "Khối lớp phụ trách"}
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                  className="mt-2 min-h-12 w-full cursor-pointer rounded-xl border-2 border-foreground bg-surface px-4 font-semibold shadow-brutal-sm focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
                >
                  {["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "THPT"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="font-bold">
                Môn học ưu tiên
                <select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="mt-2 min-h-12 w-full cursor-pointer rounded-xl border-2 border-foreground bg-surface px-4 font-semibold shadow-brutal-sm focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
                >
                  {[
                    "Khoa học",
                    "Toán học",
                    "Ngữ văn",
                    "Tiếng Anh",
                    "Lịch sử",
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-6 font-bold shadow-brutal-md transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => finish()}
                className="inline-flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 text-lg font-bold text-on-primary shadow-brutal-md transition-[transform,box-shadow] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Vào dashboard
                <ArrowRight aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => finish(true)}
              className="mx-auto mt-5 block cursor-pointer rounded-md font-bold text-muted-foreground underline decoration-2 underline-offset-4 hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
            >
              Bỏ qua thiết lập chi tiết
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
