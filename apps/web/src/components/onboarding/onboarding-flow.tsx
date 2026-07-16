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
    description: "Tiếp tục bài đang học, hoàn thành hoạt động và xem phản hồi.",
    color: "bg-secondary-soft",
  },
  {
    value: UserRole.TEACHER,
    icon: GraduationCap,
    title: "Giáo viên",
    description: "Tổ chức nội dung, quản lý lớp và đồng hành cùng người học.",
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
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6">
      <section className="w-full max-w-4xl rounded-3xl border-2 border-foreground bg-surface p-5 shadow-brutal-lg sm:p-8 lg:p-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg font-bold">
                Thiết lập không gian
              </p>
              <p className="text-sm font-semibold text-muted-foreground">
                Chọn cách bạn muốn bắt đầu
              </p>
            </div>
          </div>
          <span className="rounded-full border border-divider bg-surface-soft px-3 py-1 text-sm font-semibold tabular-nums">
            Bước {step}/2
          </span>
        </header>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-surface-soft">
          <div
            className={
              "h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none " +
              (step === 1 ? "w-1/2" : "w-full")
            }
          />
        </div>

        {step === 1 ? (
          <div className="mt-8">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-bold sm:text-4xl">
                Bạn sẽ dùng ZuniBee theo cách nào?
              </h1>
              <p className="mt-3 text-muted-foreground">
                ZuniBee sẽ chuẩn bị navigation và hành động tiếp theo phù hợp
                với vai trò của bạn.
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
                      "relative min-h-48 cursor-pointer rounded-2xl border-2 p-5 text-left transition-[border-color,box-shadow,background-color] duration-200 ease-out focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring " +
                      (selected
                        ? option.color + " border-foreground shadow-brutal-xs"
                        : "border-border bg-surface hover:border-foreground/60 hover:bg-surface-soft")
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
                        "flex h-14 w-14 items-center justify-center rounded-xl " +
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
                    <p className="mt-2 leading-relaxed text-muted-foreground">
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
              className="mt-7 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 font-semibold text-on-primary shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-md disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-soft disabled:text-muted-foreground disabled:shadow-none disabled:transform-none motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Tiếp tục
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-bold sm:text-4xl">
                Chọn điểm bắt đầu phù hợp
              </h1>
              <p className="mt-3 text-muted-foreground">
                {role === UserRole.STUDENT
                  ? "Chọn lớp và môn bạn muốn luyện tập trước."
                  : "Chọn khối lớp và môn bạn đang giảng dạy."}
              </p>
            </div>

            <div className="mx-auto mt-8 grid max-w-xl gap-5 sm:grid-cols-2">
              <label className="font-semibold">
                {role === UserRole.STUDENT
                  ? "Bạn đang học"
                  : "Khối lớp phụ trách"}
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                  className="mt-2 min-h-12 w-full cursor-pointer rounded-xl border-2 border-border bg-surface px-4 font-medium hover:border-foreground/60 focus-visible:border-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
                >
                  {["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "THPT"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="font-semibold">
                Môn học ưu tiên
                <select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="mt-2 min-h-12 w-full cursor-pointer rounded-xl border-2 border-border bg-surface px-4 font-medium hover:border-foreground/60 focus-visible:border-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
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
                className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-surface px-6 font-semibold shadow-brutal-xs transition-colors duration-200 hover:bg-surface-soft focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => finish()}
                className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 font-semibold text-on-primary shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-md motion-reduce:transform-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Vào không gian của tôi
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
