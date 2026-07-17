"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Headphones,
  Eye,
  Languages,
  ListChecks,
  PencilLine,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
  TeacherClassroomFrame,
} from "@/components/classroom/classroom-ui";
import {
  MOCK_LESSON_MODULES,
  MOCK_SOURCE_DOCUMENT,
  MOCK_TOPICS,
  type LessonActivityKind,
  type LessonModule,
  type LessonModuleKind,
} from "./lesson-mock-data";
import {
  ACTIVITY_KIND_LABELS,
  LessonActivityContent,
} from "./lesson-activity-content";

type BuilderVariant = "teacher" | "admin";
type EditableLessonModule = LessonModule & { enabled: boolean };

const STEPS = [
  {
    title: "Tài liệu nguồn",
    description: "Chọn nội dung để AI đọc",
    icon: FileText,
  },
  {
    title: "Xác định chủ đề",
    description: "Duyệt unit, chương hoặc mục",
    icon: WandSparkles,
  },
  {
    title: "Cấu trúc bài học",
    description: "Chọn các phần học cần có",
    icon: ListChecks,
  },
  {
    title: "Xác nhận bản nháp",
    description: "Kiểm tra trước khi lưu",
    icon: ShieldCheck,
  },
] as const;

const MODULE_ICONS: Record<LessonModuleKind, LucideIcon> = {
  vocabulary: Languages,
  grammar: BookOpenCheck,
  listening: Headphones,
  practice: ListChecks,
};

export function LessonBuilderMock({
  variant = "teacher",
}: {
  variant?: BuilderVariant;
}) {
  const isAdmin = variant === "admin";
  const fileInputId = useId();
  const [activeStep, setActiveStep] = useState(0);
  const [confirmedSteps, setConfirmedSteps] = useState<number[]>([]);
  const [source, setSource] = useState(MOCK_SOURCE_DOCUMENT);
  const [selectedTopicId, setSelectedTopicId] = useState(
    MOCK_TOPICS[0].id as string,
  );
  const [title, setTitle] = useState(
    "Unit 6 · Lifestyles — Xây dựng thói quen tích cực",
  );
  const [audience, setAudience] = useState("Lớp 8 · Trình độ A2");
  const [modules, setModules] = useState<EditableLessonModule[]>(
    MOCK_LESSON_MODULES.map((module) => ({ ...module, enabled: true })),
  );
  const [reviewApproved, setReviewApproved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewModuleId, setPreviewModuleId] =
    useState<LessonModuleKind | null>(null);

  const selectedTopic =
    MOCK_TOPICS.find((topic) => topic.id === selectedTopicId) ?? MOCK_TOPICS[0];
  const enabledModules = modules.filter((module) => module.enabled);
  const prerequisitesConfirmed = [0, 1, 2].every((step) =>
    confirmedSteps.includes(step),
  );
  const totalMinutes = useMemo(
    () =>
      enabledModules.reduce(
        (total, module) => total + module.durationMinutes,
        0,
      ),
    [enabledModules],
  );
  const panelClass = isAdmin
    ? "rounded-2xl border border-divider bg-surface shadow-sm"
    : "rounded-3xl border-2 border-foreground bg-surface shadow-brutal-sm";
  const previewModule = modules.find(
    (module) => module.id === previewModuleId,
  );

  function markStepConfirmed(step: number) {
    setConfirmedSteps((current) =>
      current.includes(step) ? current : [...current, step],
    );
  }

  function invalidateStep(step: number) {
    setConfirmedSteps((current) => current.filter((item) => item !== step));
    setSaved(false);
  }

  function continueFlow() {
    markStepConfirmed(activeStep);
    setSaved(false);
    if (activeStep < STEPS.length - 1) {
      setActiveStep((current) => current + 1);
      return;
    }
    setSaved(true);
  }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    setSource({
      name: file.name,
      size: formatFileSize(file.size),
      pageCount: 24,
      language: "Chờ xác nhận sau khi AI nhận diện",
    });
    setConfirmedSteps([]);
    setActiveStep(0);
    setSaved(false);
  }

  function updateModule(
    moduleId: LessonModuleKind,
    patch: Partial<EditableLessonModule>,
  ) {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId ? { ...module, ...patch } : module,
      ),
    );
    setConfirmedSteps((current) => current.filter((step) => step !== 2));
    setSaved(false);
  }

  const content = (
    <div className="motion-enter">
      <header className="mb-7 flex flex-col gap-5 border-b border-divider pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="editorial-label flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
              Xưởng bài học theo chủ đề
            </p>
            <span className="rounded-full border border-purple/25 bg-purple-soft px-3 py-1 text-xs font-semibold text-purple">
              Prototype UI · Dữ liệu mẫu
            </span>
          </div>
          <h1 className="mt-3 max-w-4xl font-display text-3xl font-bold sm:text-4xl lg:text-[2.75rem]">
            Từ tài liệu thành một bài học có cấu trúc.
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            AI chỉ đọc, nhận diện và chuẩn bị bản nháp. {isAdmin ? "Admin" : "Giáo viên"}{" "}
            luôn kiểm tra từng bước trước khi bài học được lưu hoặc phát hành.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-divider bg-surface-soft px-4 py-3">
          <ShieldCheck className="h-6 w-6 text-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Human-in-the-loop</p>
            <p className="text-xs text-muted-foreground">
              Không tự động phát hành
            </p>
          </div>
        </div>
      </header>

      {saved ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-success/40 bg-success-soft p-4"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Đã lưu bản nháp mô phỏng</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Chưa có dữ liệu nào được gửi lên máy chủ. Khi nối backend, bản
              nháp này sẽ đi qua bước duyệt trước khi phân phối cho học sinh.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className={`${panelClass} overflow-hidden lg:sticky lg:top-24`}>
          <div className="border-b border-divider p-5">
            <p className="text-sm font-semibold">Tiến trình tạo bài học</p>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-surface-soft"
              role="progressbar"
              aria-label="Tiến trình tạo bài học"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(((activeStep + 1) / STEPS.length) * 100)}
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${((activeStep + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Bước {activeStep + 1} / {STEPS.length}
            </p>
          </div>
          <ol
            className="flex gap-1 overflow-x-auto p-2 lg:block"
            aria-label="Các bước tạo bài học"
          >
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const active = activeStep === index;
              const confirmed = confirmedSteps.includes(index);
              return (
                <li key={step.title} className="w-[15rem] shrink-0 lg:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveStep(index)}
                    aria-current={active ? "step" : undefined}
                    className={`flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-primary text-on-primary" : "hover:bg-surface-soft"}`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-surface/80" : confirmed ? "bg-success-soft" : "bg-surface-soft"}`}
                    >
                      {confirmed ? (
                        <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                      ) : (
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {step.title}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs ${active ? "text-on-primary/70" : "text-muted-foreground"}`}
                      >
                        {step.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className={`${panelClass} min-w-0 overflow-hidden`}>
          <div className="border-b border-divider px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="editorial-label">Bước {activeStep + 1}</p>
                <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
                  {STEPS[activeStep].title}
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-purple/25 bg-purple-soft px-3 py-1.5 text-xs font-semibold text-purple">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                AI đề xuất · cần xác nhận
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {activeStep === 0 ? (
              <DocumentStep
                fileInputId={fileInputId}
                source={source}
                onChooseFile={chooseFile}
              />
            ) : null}
            {activeStep === 1 ? (
              <TopicStep
                selectedTopicId={selectedTopicId}
                onSelectTopic={(topicId) => {
                  setSelectedTopicId(topicId);
                  invalidateStep(1);
                }}
                title={title}
                onTitleChange={(nextTitle) => {
                  setTitle(nextTitle);
                  invalidateStep(1);
                }}
                audience={audience}
                onAudienceChange={(nextAudience) => {
                  setAudience(nextAudience);
                  invalidateStep(1);
                }}
              />
            ) : null}
            {activeStep === 2 ? (
              <StructureStep
                modules={modules}
                onUpdate={updateModule}
                onPreview={(moduleId) => setPreviewModuleId(moduleId)}
              />
            ) : null}
            {activeStep === 3 ? (
              <ReviewStep
                sourceName={source.name}
                topicLabel={selectedTopic.label}
                title={title}
                audience={audience}
                modules={enabledModules}
                totalMinutes={totalMinutes}
                approved={reviewApproved}
                onApprovedChange={setReviewApproved}
                prerequisitesConfirmed={prerequisitesConfirmed}
              />
            ) : null}
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-divider bg-surface-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <button
              type="button"
              onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
              disabled={activeStep === 0}
              className={SECONDARY_ACTION_CLASS}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              Quay lại
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-center text-xs text-muted-foreground sm:text-right">
                Xác nhận của người tạo sẽ được lưu trong lịch sử phiên bản.
              </p>
              <button
                type="button"
                onClick={continueFlow}
                disabled={
                  (activeStep === 1 && !title.trim()) ||
                  (activeStep === 2 && enabledModules.length === 0) ||
                  (activeStep === 3 &&
                    (!reviewApproved || !prerequisitesConfirmed))
                }
                className={PRIMARY_ACTION_CLASS}
              >
                {activeStep === STEPS.length - 1 ? (
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                )}
                {activeStep === STEPS.length - 1
                  ? "Xác nhận & lưu bản nháp"
                  : "Xác nhận và tiếp tục"}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );

  return (
    <>
      {variant === "teacher" ? (
        <TeacherClassroomFrame>{content}</TeacherClassroomFrame>
      ) : (
        content
      )}
      {previewModule ? (
        <ModulePreviewDialog
          key={previewModule.id}
          module={previewModule}
          onClose={() => setPreviewModuleId(null)}
        />
      ) : null}
    </>
  );
}

function DocumentStep({
  fileInputId,
  source,
  onChooseFile,
}: {
  fileInputId: string;
  source: typeof MOCK_SOURCE_DOCUMENT;
  onChooseFile: (file: File | undefined) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <div>
        <h3 className="font-display text-xl font-bold">
          Tải tài liệu muốn chuyển thành bài học
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ở prototype này, tệp chỉ được hiển thị cục bộ để mô phỏng quá trình
          nhận diện. Chưa có nội dung nào được tải lên hoặc gửi đến AI.
        </p>
        <input
          id={fileInputId}
          type="file"
          accept=".pdf,.docx,.pptx,.txt"
          className="sr-only"
          onChange={(event) => onChooseFile(event.target.files?.[0])}
        />
        <label
          htmlFor={fileInputId}
          className="mt-5 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-soft p-6 text-center transition-[border-color,background-color] duration-200 hover:border-foreground/50 hover:bg-secondary-soft focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ring"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <UploadCloud className="h-7 w-7" aria-hidden="true" />
          </span>
          <span className="mt-4 font-semibold">Chọn PDF, DOCX, PPTX hoặc TXT</span>
          <span className="mt-1 text-sm text-muted-foreground">
            Bản thật dự kiến hỗ trợ tối đa 50 MB
          </span>
          <span className="mt-4 rounded-xl border border-divider bg-surface px-4 py-2 text-sm font-semibold">
            Chọn tài liệu khác
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-divider bg-surface-soft p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-soft">
            <FileCheck2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="editorial-label">Tài liệu đang dùng</p>
            <h3 className="mt-1 break-words font-display text-xl font-bold">
              {source.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {source.size} · {source.pageCount} trang
            </p>
          </div>
        </div>
        <dl className="mt-6 space-y-4 text-sm">
          <InfoRow label="Ngôn ngữ" value={source.language} />
          <InfoRow label="Cấu trúc nhận diện" value="1 unit · 7 mục · 16 hoạt động" />
          <InfoRow label="Độ rõ văn bản" value="Tốt · 96% nội dung có thể đọc" />
        </dl>
        <div className="mt-6 rounded-xl border border-purple/25 bg-purple-soft p-4">
          <p className="flex items-center gap-2 font-semibold text-purple">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Phạm vi AI ở giai đoạn này
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Đọc văn bản, nhận diện mục lục, gợi ý chủ đề và dựng bản nháp. AI
            không tự phân phối, chấm điểm hay thay người tạo phê duyệt.
          </p>
        </div>
      </div>
    </div>
  );
}

function TopicStep({
  selectedTopicId,
  onSelectTopic,
  title,
  onTitleChange,
  audience,
  onAudienceChange,
}: {
  selectedTopicId: string;
  onSelectTopic: (topicId: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  audience: string;
  onAudienceChange: (audience: string) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.82fr]">
      <fieldset>
        <legend className="font-display text-xl font-bold">
          Chủ đề AI nhận diện từ tài liệu
        </legend>
        <p className="mt-2 text-sm text-muted-foreground">
          Chọn một unit, chương hoặc mục làm phạm vi chính của bài học.
        </p>
        <div className="mt-5 space-y-3">
          {MOCK_TOPICS.map((topic) => {
            const selected = topic.id === selectedTopicId;
            return (
              <label
                key={topic.id}
                className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors duration-200 ${selected ? "border-foreground bg-primary/20" : "border-divider bg-surface hover:bg-surface-soft"}`}
              >
                <input
                  type="radio"
                  name="lesson-topic"
                  value={topic.id}
                  checked={selected}
                  onChange={() => onSelectTopic(topic.id)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{topic.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {topic.description}
                  </span>
                </span>
                <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold tabular-nums">
                  {topic.confidence}%
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-2xl border border-divider bg-surface-soft p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <PencilLine className="h-5 w-5 text-secondary-strong" aria-hidden="true" />
          <h3 className="font-display text-xl font-bold">Người tạo hoàn thiện</h3>
        </div>
        <label className="mt-5 block">
          <span className="font-semibold">Tên bài học</span>
          <input
            value={title}
            maxLength={180}
            onChange={(event) => onTitleChange(event.target.value)}
            className={`${INPUT_CLASS} mt-2`}
          />
        </label>
        <label className="mt-5 block">
          <span className="font-semibold">Đối tượng học</span>
          <input
            value={audience}
            maxLength={120}
            onChange={(event) => onAudienceChange(event.target.value)}
            className={`${INPUT_CLASS} mt-2`}
          />
        </label>
        <div className="mt-5 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <p className="font-semibold">Cần kiểm tra trước khi tiếp tục</p>
          <p className="mt-1 text-muted-foreground">
            Độ tin cậy chỉ là gợi ý. Người tạo chịu trách nhiệm chọn đúng phạm
            vi và điều chỉnh tên bài học phù hợp với lớp.
          </p>
        </div>
      </div>
    </div>
  );
}

function StructureStep({
  modules,
  onUpdate,
  onPreview,
}: {
  modules: EditableLessonModule[];
  onUpdate: (
    moduleId: LessonModuleKind,
    patch: Partial<EditableLessonModule>,
  ) => void;
  onPreview: (moduleId: LessonModuleKind) => void;
}) {
  return (
    <div>
      <div className="max-w-3xl">
        <h3 className="font-display text-xl font-bold">
          Chọn mạch học phù hợp với chủ đề
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          AI đề xuất bốn phần theo nội dung đã nhận diện. Người tạo có thể bỏ
          phần không cần thiết và điều chỉnh thời lượng trước khi duyệt.
        </p>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {modules.map((module, index) => {
          const Icon = MODULE_ICONS[module.id];
          return (
            <article
              key={module.id}
              className={`rounded-2xl border p-5 transition-colors duration-200 ${module.enabled ? "border-foreground/40 bg-surface" : "border-divider bg-surface-soft opacity-70"}`}
            >
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-soft text-secondary-strong">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="editorial-label">Phần {index + 1}</p>
                      <h4 className="mt-1 font-display text-lg font-bold">
                        {module.title}
                      </h4>
                    </div>
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-divider bg-surface px-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={module.enabled}
                        onChange={(event) =>
                          onUpdate(module.id, { enabled: event.target.checked })
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      Sử dụng
                    </label>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {module.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => onPreview(module.id)}
                    className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-divider bg-surface px-3 text-sm font-semibold transition-[border-color,background-color] duration-200 hover:border-foreground/40 hover:bg-secondary-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    Xem toàn bộ nội dung
                  </button>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <Clock3 className="h-4 w-4" aria-hidden="true" />
                      <span>Thời lượng</span>
                      <select
                        value={module.durationMinutes}
                        disabled={!module.enabled}
                        onChange={(event) =>
                          onUpdate(module.id, {
                            durationMinutes: Number(event.target.value),
                          })
                        }
                        className="min-h-10 rounded-xl border border-divider bg-surface px-3 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {[5, 7, 8, 10, 12, 15].map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes} phút
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="rounded-full bg-surface-soft px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                      {module.activityCount} hoạt động
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ModulePreviewDialog({
  module,
  onClose,
}: {
  module: EditableLessonModule;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [activityId, setActivityId] = useState(module.activities[0].id);
  const activity =
    module.activities.find((item) => item.id === activityId) ??
    module.activities[0];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="module-preview-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-2 text-foreground backdrop-blur-[2px] sm:p-4"
    >
      <div className="flex max-h-[92dvh] min-h-[70dvh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border-2 border-foreground bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-divider px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="editorial-label">Xem trước nội dung học sinh</p>
              <span className="rounded-full border border-purple/25 bg-purple-soft px-3 py-1 text-xs font-semibold text-purple">
                {module.activityCount} hoạt động · {module.durationMinutes} phút
              </span>
            </div>
            <h2
              id="module-preview-title"
              className="mt-2 font-display text-2xl font-bold sm:text-3xl"
            >
              {module.title}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {module.description}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng xem trước nội dung"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-divider bg-surface transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-w-0 max-w-full overflow-hidden border-b border-divider bg-surface-soft lg:border-b-0 lg:border-r">
            <div className="hidden border-b border-divider p-5 lg:block">
              <p className="editorial-label">Mục tiêu phần học</p>
              <ul className="mt-3 space-y-2 text-sm">
                {module.objectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-success"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    {objective}
                  </li>
                ))}
              </ul>
            </div>
            <nav aria-label="Nội dung trong phần học" className="p-2">
              <ol className="flex gap-1 overflow-x-auto lg:block">
                {module.activities.map((item, index) => {
                  const Icon = activityIcon(item.kind);
                  const active = item.id === activity.id;
                  return (
                    <li
                      key={item.id}
                      className="w-[15rem] shrink-0 lg:w-auto"
                    >
                      <button
                        type="button"
                        onClick={() => setActivityId(item.id)}
                        aria-current={active ? "step" : undefined}
                        className={`flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-primary text-on-primary" : "hover:bg-surface"}`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface/80">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold uppercase tracking-[0.08em] opacity-70">
                            {index + 1}. {ACTIVITY_KIND_LABELS[item.kind]}
                          </span>
                          <span className="mt-0.5 block text-sm font-semibold">
                            {item.title}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </aside>

          <main className="min-h-0 w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto p-5 sm:p-7">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-divider pb-5">
              <div>
                <p className="editorial-label">
                  {ACTIVITY_KIND_LABELS[activity.kind]}
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold">
                  {activity.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activity.description}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface-soft px-3 py-1.5 text-sm font-semibold">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                {activity.durationMinutes} phút
              </span>
            </div>
            <LessonActivityContent key={activity.id} activity={activity} />
          </main>
        </div>
      </div>
    </div>
  );
}

function activityIcon(kind: LessonActivityKind): LucideIcon {
  if (kind === "flashcards") return Languages;
  if (kind === "listening") return Headphones;
  if (kind === "quiz" || kind === "fill_blank") return ListChecks;
  if (kind === "writing") return PencilLine;
  if (kind === "reflection") return ShieldCheck;
  return BookOpenCheck;
}

function ReviewStep({
  sourceName,
  topicLabel,
  title,
  audience,
  modules,
  totalMinutes,
  approved,
  onApprovedChange,
  prerequisitesConfirmed,
}: {
  sourceName: string;
  topicLabel: string;
  title: string;
  audience: string;
  modules: EditableLessonModule[];
  totalMinutes: number;
  approved: boolean;
  onApprovedChange: (approved: boolean) => void;
  prerequisitesConfirmed: boolean;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.78fr]">
      <div>
        <div className="rounded-2xl border border-divider bg-surface-soft p-5 sm:p-6">
          <p className="editorial-label">Bản nháp bài học</p>
          <h3 className="mt-2 font-display text-2xl font-bold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {audience} · {totalMinutes} phút · {modules.length} phần học
          </p>
          <dl className="mt-5 grid gap-3 border-t border-divider pt-5 text-sm sm:grid-cols-2">
            <InfoRow label="Tài liệu nguồn" value={sourceName} />
            <InfoRow label="Phạm vi" value={topicLabel} />
          </dl>
        </div>
        <ol className="mt-5 space-y-3">
          {modules.map((module, index) => {
            const Icon = MODULE_ICONS[module.id];
            return (
              <li
                key={module.id}
                className="flex items-center gap-4 rounded-2xl border border-divider bg-surface p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-soft text-secondary-strong">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {index + 1}. {module.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {module.activityCount} hoạt động · {module.durationMinutes} phút
                  </span>
                </span>
                <CheckCircle2 className="h-5 w-5 text-success" aria-label="Đã có nội dung mẫu" />
              </li>
            );
          })}
        </ol>
      </div>

      <aside className="rounded-2xl border border-warning/30 bg-warning-soft p-5 sm:p-6">
        <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        <h3 className="mt-3 font-display text-xl font-bold">
          Xác nhận trách nhiệm người tạo
        </h3>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          {[
            "Chủ đề khớp với phạm vi tài liệu nguồn.",
            "Cấu trúc phù hợp với trình độ và mục tiêu học.",
            "Nội dung AI tạo sẽ tiếp tục được chỉnh sửa trước khi phát hành.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        {!prerequisitesConfirmed ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-destructive/25 bg-destructive-soft p-3 text-sm font-semibold"
          >
            Hãy quay lại xác nhận ba bước trước khi lưu bản nháp.
          </p>
        ) : null}
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/20 bg-surface p-4">
          <input
            type="checkbox"
            checked={approved}
            onChange={(event) => onApprovedChange(event.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span className="text-sm font-semibold">
            Tôi đã kiểm tra bản nháp và xác nhận lưu để tiếp tục biên tập.
          </span>
        </label>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Nút cuối chỉ lưu bản nháp. Phát hành cho học sinh sẽ là một thao tác
          riêng có xác nhận ở phiên bản kết nối backend.
        </p>
      </aside>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
