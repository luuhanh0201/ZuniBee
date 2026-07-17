"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Flag,
  Headphones,
  Languages,
  ListChecks,
  Send,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@zunibee/shared";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import {
  ACTIVITY_KIND_LABELS,
  LessonActivityContent,
} from "./lesson-activity-content";
import {
  MOCK_LESSON_COURSE,
  MOCK_LESSON_MODULES,
  type LessonModuleKind,
} from "./lesson-mock-data";

const MODULE_ICONS: Record<LessonModuleKind, LucideIcon> = {
  vocabulary: Languages,
  grammar: BookOpenCheck,
  listening: Headphones,
  practice: ListChecks,
};

const ALL_ACTIVITIES = MOCK_LESSON_MODULES.flatMap((module) =>
  module.activities.map((activity) => ({
    activity,
    moduleId: module.id,
  })),
);

export function StudentLessonWorkspace() {
  const firstModule = MOCK_LESSON_MODULES[0];
  const [activeModuleId, setActiveModuleId] = useState(firstModule.id);
  const [activeActivityId, setActiveActivityId] = useState(
    firstModule.activities[0].id,
  );
  const [completedActivityIds, setCompletedActivityIds] = useState<string[]>(
    [],
  );
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [rating, setRating] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Nội dung chưa chính xác");
  const [reportDetail, setReportDetail] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const activeModule =
    MOCK_LESSON_MODULES.find((module) => module.id === activeModuleId) ??
    firstModule;
  const activeActivity =
    activeModule.activities.find(
      (activity) => activity.id === activeActivityId,
    ) ?? activeModule.activities[0];
  const activeModuleIndex = MOCK_LESSON_MODULES.findIndex(
    (module) => module.id === activeModule.id,
  );
  const activeActivityIndex = activeModule.activities.findIndex(
    (activity) => activity.id === activeActivity.id,
  );
  const flatActivityIndex = ALL_ACTIVITIES.findIndex(
    ({ activity }) => activity.id === activeActivity.id,
  );
  const progress = Math.round(
    (completedActivityIds.length / ALL_ACTIVITIES.length) * 100,
  );
  const completedModuleCount = useMemo(
    () =>
      MOCK_LESSON_MODULES.filter((module) =>
        module.activities.every((activity) =>
          completedActivityIds.includes(activity.id),
        ),
      ).length,
    [completedActivityIds],
  );

  function selectModule(moduleId: LessonModuleKind) {
    const nextModule = MOCK_LESSON_MODULES.find(
      (module) => module.id === moduleId,
    );
    if (!nextModule) return;
    setActiveModuleId(moduleId);
    setActiveActivityId(nextModule.activities[0].id);
  }

  function goToFlatActivity(index: number) {
    const next = ALL_ACTIVITIES[index];
    if (!next) return;
    setActiveModuleId(next.moduleId);
    setActiveActivityId(next.activity.id);
  }

  function completeAndContinue() {
    setCompletedActivityIds((current) =>
      current.includes(activeActivity.id)
        ? current
        : [...current, activeActivity.id],
    );
    if (flatActivityIndex < ALL_ACTIVITIES.length - 1) {
      goToFlatActivity(flatActivityIndex + 1);
      return;
    }
    setCourseCompleted(true);
  }

  function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportSent(true);
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Bỏ qua điều hướng
      </a>
      <DashboardHeader role={UserRole.STUDENT} />
      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      >
        <header className="motion-enter mb-7 flex flex-col gap-5 border-b border-divider pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="editorial-label flex items-center gap-2">
                <BookOpenCheck
                  className="h-4 w-4 text-secondary-strong"
                  aria-hidden="true"
                />
                Bài học theo chủ đề
              </p>
              <span className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-xs font-semibold">
                Giáo viên đã xác nhận
              </span>
              <span className="rounded-full border border-purple/25 bg-purple-soft px-3 py-1 text-xs font-semibold text-purple">
                Prototype UI
              </span>
            </div>
            <h1 className="mt-3 max-w-4xl font-display text-3xl font-bold sm:text-4xl lg:text-[2.75rem]">
              {MOCK_LESSON_COURSE.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {MOCK_LESSON_COURSE.subtitle}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>{MOCK_LESSON_COURSE.level}</span>
              <span>{MOCK_LESSON_COURSE.durationMinutes} phút</span>
              <span>{ALL_ACTIVITIES.length} hoạt động</span>
              <span>GV: {MOCK_LESSON_COURSE.teacher}</span>
            </div>
          </div>
          <div className="min-w-64 rounded-2xl border border-divider bg-surface p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Tiến độ bài học</span>
              <span className="font-semibold tabular-nums">{progress}%</span>
            </div>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-soft"
              role="progressbar"
              aria-label="Tiến độ hoàn thành bài học"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {completedActivityIds.length}/{ALL_ACTIVITIES.length} hoạt động ·{" "}
              {completedModuleCount}/{MOCK_LESSON_MODULES.length} phần hoàn thành
            </p>
          </div>
        </header>

        {courseCompleted ? (
          <section
            role="status"
            className="motion-enter mb-6 flex flex-col gap-4 rounded-2xl border-2 border-success bg-success-soft p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-6 w-6 shrink-0 text-success"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-display text-xl font-bold">
                  Bạn đã đi hết bài học mẫu
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hãy đánh giá bài học hoặc báo nội dung cần giáo viên xem lại.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCourseCompleted(false);
                goToFlatActivity(0);
              }}
              className={SECONDARY_ACTION_CLASS}
            >
              Học lại từ đầu
            </button>
          </section>
        ) : null}

        <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="motion-enter motion-delay-1 overflow-hidden rounded-2xl border border-divider bg-surface lg:sticky lg:top-6">
            <div className="border-b border-divider p-5">
              <p className="editorial-label">Mạch học</p>
              <h2 className="mt-1 font-display text-xl font-bold">
                {MOCK_LESSON_MODULES.length} phần ·{" "}
                {MOCK_LESSON_COURSE.durationMinutes} phút
              </h2>
            </div>
            <ol
              className="flex gap-1 overflow-x-auto p-2 lg:block"
              aria-label="Nội dung bài học"
            >
              {MOCK_LESSON_MODULES.map((module, index) => {
                const Icon = MODULE_ICONS[module.id];
                const active = activeModule.id === module.id;
                const completedCount = module.activities.filter((activity) =>
                  completedActivityIds.includes(activity.id),
                ).length;
                const completed = completedCount === module.activities.length;
                return (
                  <li key={module.id} className="w-[16rem] shrink-0 lg:w-auto">
                    <button
                      type="button"
                      onClick={() => selectModule(module.id)}
                      aria-current={active ? "step" : undefined}
                      className={`flex min-h-20 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-primary text-on-primary" : "hover:bg-surface-soft"}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-surface/80" : completed ? "bg-success-soft" : "bg-surface-soft"}`}
                      >
                        {completed ? (
                          <Check
                            className="h-5 w-5"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        ) : (
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold uppercase tracking-[0.08em] opacity-70">
                          Phần {index + 1}
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold">
                          {module.title}
                        </span>
                        <span className="mt-1 block text-xs opacity-70">
                          {completedCount}/{module.activities.length} hoạt động
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-divider bg-surface-soft p-4 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                Phiên bản {MOCK_LESSON_COURSE.version} · đã duyệt
              </p>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <article className="motion-enter motion-delay-2 overflow-hidden rounded-3xl border-2 border-foreground bg-surface shadow-brutal-sm">
              <header className="border-b border-divider px-5 py-5 sm:px-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="editorial-label">
                      Phần {activeModuleIndex + 1} / {MOCK_LESSON_MODULES.length}
                      {" · "}Hoạt động {activeActivityIndex + 1} /{" "}
                      {activeModule.activities.length}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-secondary-strong">
                      {activeModule.title}
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
                      {activeActivity.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {activeActivity.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-secondary/25 bg-secondary-soft px-3 py-1.5 text-sm font-semibold">
                      {ACTIVITY_KIND_LABELS[activeActivity.kind]}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface-soft px-3 py-1.5 text-sm font-semibold">
                      <Clock3 className="h-4 w-4" aria-hidden="true" />
                      {activeActivity.durationMinutes} phút
                    </span>
                  </div>
                </div>
              </header>

              <nav
                aria-label={`Hoạt động trong ${activeModule.title}`}
                className="border-b border-divider bg-surface-soft px-3 py-3 sm:px-5"
              >
                <ol className="flex gap-2 overflow-x-auto pb-1">
                  {activeModule.activities.map((activity, index) => {
                    const active = activity.id === activeActivity.id;
                    const completed = completedActivityIds.includes(activity.id);
                    return (
                      <li key={activity.id} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveActivityId(activity.id)}
                          aria-current={active ? "step" : undefined}
                          className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "border-foreground bg-surface" : "border-divider bg-surface hover:border-secondary"}`}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${completed ? "bg-success-soft text-success" : active ? "bg-primary" : "bg-surface-soft"}`}
                          >
                            {completed ? (
                              <Check
                                className="h-4 w-4"
                                strokeWidth={3}
                                aria-hidden="true"
                              />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className="max-w-44 truncate">{activity.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <div className="p-5 sm:p-7">
                <LessonActivityContent
                  key={activeActivity.id}
                  activity={activeActivity}
                />
              </div>

              <footer className="flex flex-col gap-3 border-t border-divider bg-surface-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <button
                  type="button"
                  onClick={() => goToFlatActivity(flatActivityIndex - 1)}
                  disabled={flatActivityIndex === 0}
                  className={SECONDARY_ACTION_CLASS}
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  Hoạt động trước
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  {flatActivityIndex + 1}/{ALL_ACTIVITIES.length} trong toàn bài
                </p>
                <button
                  type="button"
                  onClick={completeAndContinue}
                  className={PRIMARY_ACTION_CLASS}
                >
                  {flatActivityIndex === ALL_ACTIVITIES.length - 1 ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  )}
                  {flatActivityIndex === ALL_ACTIVITIES.length - 1
                    ? "Hoàn thành bài học"
                    : "Hoàn thành & tiếp tục"}
                </button>
              </footer>
            </article>

            <section
              aria-labelledby="lesson-feedback-title"
              className="rounded-2xl border border-divider bg-surface p-5 sm:p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="editorial-label">Phản hồi nội dung</p>
                  <h2
                    id="lesson-feedback-title"
                    className="mt-1 font-display text-xl font-bold"
                  >
                    Bài học này có hữu ích với bạn không?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Đánh giá giúp giáo viên cải thiện cấu trúc và độ khó của bài.
                  </p>
                  <div
                    className="mt-4 flex items-center gap-1"
                    aria-label="Đánh giá bài học"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        aria-label={`${value} sao`}
                        aria-pressed={rating === value}
                        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-warning-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <Star
                          className={`h-6 w-6 ${value <= rating ? "fill-primary text-foreground" : "text-muted-foreground"}`}
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                    {rating ? (
                      <span className="ml-2 text-sm font-semibold" role="status">
                        Đã chọn {rating}/5
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReportOpen((current) => !current);
                    setReportSent(false);
                  }}
                  aria-expanded={reportOpen}
                  aria-controls="lesson-report-form"
                  className={SECONDARY_ACTION_CLASS}
                >
                  <Flag className="h-5 w-5" aria-hidden="true" />
                  Báo cáo nội dung
                </button>
              </div>

              {reportOpen ? (
                <form
                  id="lesson-report-form"
                  onSubmit={submitReport}
                  className="mt-6 rounded-2xl border border-destructive/25 bg-destructive-soft p-5"
                >
                  <div className="flex items-start gap-3">
                    <CircleAlert
                      className="mt-0.5 h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="font-semibold">
                        Báo cho giáo viên xem lại
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Báo cáo sẽ gắn với hoạt động “{activeActivity.title}”
                        đang mở.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <label>
                      <span className="text-sm font-semibold">Lý do</span>
                      <select
                        value={reportReason}
                        onChange={(event) => setReportReason(event.target.value)}
                        className="mt-2 min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 text-base focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <option>Nội dung chưa chính xác</option>
                        <option>Không phù hợp với trình độ</option>
                        <option>Ví dụ hoặc bài tập khó hiểu</option>
                        <option>Lỗi hiển thị hoặc âm thanh</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-sm font-semibold">Mô tả thêm</span>
                      <textarea
                        value={reportDetail}
                        onChange={(event) => setReportDetail(event.target.value)}
                        placeholder="Cho giáo viên biết phần nào cần xem lại..."
                        className="mt-2 min-h-28 w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base placeholder:text-muted-foreground/75 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {reportSent ? (
                      <p
                        className="flex items-center gap-2 text-sm font-semibold"
                        role="status"
                      >
                        <CheckCircle2
                          className="h-5 w-5 text-success"
                          aria-hidden="true"
                        />
                        Đã ghi nhận báo cáo mô phỏng.
                      </p>
                    ) : (
                      <span />
                    )}
                    <button type="submit" className={PRIMARY_ACTION_CLASS}>
                      <Send className="h-5 w-5" aria-hidden="true" />
                      Gửi báo cáo
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
