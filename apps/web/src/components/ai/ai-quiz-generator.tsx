"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BrainCircuit,
  Coins,
  FileText,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import type {
  AiCreditAccount,
  AiGenerationJob,
  AiQuizLanguage,
  QuizQuestionType,
} from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { teacherQuizRoute } from "@/config/routes";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import {
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
  TeacherClassroomFrame,
} from "@/components/classroom/classroom-ui";
import {
  generateQuizWithAi,
  getAiQuizGenerationJob,
  getMyAiCredit,
} from "./ai-api";

const TYPES: Array<{ value: QuizQuestionType; label: string }> = [
  { value: "single_choice", label: "Một đáp án" },
  { value: "true_false", label: "Đúng / Sai" },
  { value: "multiple_choice", label: "Nhiều đáp án" },
];
const ACTIVE_JOB_KEY_PREFIX = "zunibee:ai-quiz-generation:";

export function AiQuizGenerator() {
  const { accessToken, user } = useAuth();
  const router = useRouter();
  const lock = useRef(false);
  const [credit, setCredit] = useState<AiCreditAccount | null>(null);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium",
  );
  const [language, setLanguage] = useState<AiQuizLanguage>("auto");
  const [questionTypes, setQuestionTypes] = useState<QuizQuestionType[]>(
    TYPES.map((item) => item.value),
  );
  const [sourceType, setSourceType] = useState<"prompt" | "upload">("prompt");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<AiGenerationJob | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    getMyAiCredit(accessToken)
      .then(setCredit)
      .catch((cause) => setError(getErrorMessage(cause)));
  }, [accessToken]);

  useEffect(() => {
    if (!user) return;
    const savedJobId = window.localStorage.getItem(
      `${ACTIVE_JOB_KEY_PREFIX}${user.id}`,
    );
    if (!savedJobId) return;
    const timer = window.setTimeout(() => {
      setActiveJobId(savedJobId);
      setBusy(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (!accessToken || !activeJobId) return;
    const token = accessToken;
    const jobId = activeJobId;
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const job = await getAiQuizGenerationJob(jobId, token);
        if (cancelled) return;
        setJobProgress(job);
        if (job.status === "succeeded") {
          setBusy(false);
          setActiveJobId(null);
          if (user)
            window.localStorage.removeItem(
              `${ACTIVE_JOB_KEY_PREFIX}${user.id}`,
            );
          if (job.quizId) router.push(teacherQuizRoute(job.quizId));
          return;
        }
        if (job.status === "failed") {
          setBusy(false);
          setActiveJobId(null);
          setError(job.errorMessage || "Không thể sinh quiz từ tài liệu này.");
          if (user)
            window.localStorage.removeItem(
              `${ACTIVE_JOB_KEY_PREFIX}${user.id}`,
            );
          getMyAiCredit(token)
            .then(setCredit)
            .catch(() => undefined);
          return;
        }
      } catch {
        // Job có thể chưa được tạo trong vài mili giây đầu của request upload.
      }
      if (!cancelled) timer = window.setTimeout(() => void poll(), 1_000);
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [accessToken, activeJobId, router, user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !accessToken) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const jobId = crypto.randomUUID();
    setActiveJobId(jobId);
    setJobProgress(null);
    if (user)
      window.localStorage.setItem(`${ACTIVE_JOB_KEY_PREFIX}${user.id}`, jobId);
    try {
      const result = await generateQuizWithAi(
        {
          jobId,
          title,
          description,
          topic,
          language,
          difficulty,
          questionCount,
          questionTypes,
          sourceType,
        },
        sourceType === "upload" ? (sourceFile ?? undefined) : undefined,
        accessToken,
      );
      setJobProgress(result.job);
      setCredit(result.credit);
    } catch (cause) {
      setError(getErrorMessage(cause));
      setBusy(false);
      setActiveJobId(null);
      if (user)
        window.localStorage.removeItem(`${ACTIVE_JOB_KEY_PREFIX}${user.id}`);
    } finally {
      lock.current = false;
    }
  }

  return (
    <TeacherClassroomFrame>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="editorial-label">Trợ lý soạn nội dung</p>
          <h1 className="mt-3 font-display text-4xl font-bold">
            Tạo hoạt động từ tài liệu
          </h1>
          <p className="mt-2 max-w-2xl font-semibold text-muted-foreground">
            AI chuẩn bị một bản nháp có căn cứ. Giáo viên luôn là người kiểm
            tra, chỉnh sửa và quyết định phát hành.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-warning/30 bg-warning-soft px-4 py-2.5">
          <Coins className="h-5 w-5" aria-hidden="true" />
          <span className="font-extrabold tabular-nums">
            {credit?.available ?? 0} credit khả dụng
          </span>
        </div>
      </header>
      <form
        onSubmit={submit}
        className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]"
      >
        <section className="study-surface grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Tiêu đề hoạt động">
            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Chủ đề">
            <input
              required
              maxLength={500}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Mô tả">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${INPUT_CLASS} min-h-28`}
            />
          </Field>
          <Field label="Độ khó">
            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as typeof difficulty)
              }
              className={INPUT_CLASS}
            >
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </Field>
          <Field label="Ngôn ngữ câu hỏi">
            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as AiQuizLanguage)
              }
              className={INPUT_CLASS}
            >
              <option value="auto">Tự động theo tài liệu/chủ đề</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="Số câu hỏi">
            <input
              type="number"
              min={1}
              max={50}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className={INPUT_CLASS}
            />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="font-bold">Loại câu hỏi</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {TYPES.map((item) => (
                <label
                  key={item.value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-divider bg-surface-soft px-3 py-2 font-bold transition-colors hover:border-foreground/40 has-checked:border-foreground has-checked:bg-primary-soft"
                >
                  <input
                    type="checkbox"
                    checked={questionTypes.includes(item.value)}
                    onChange={(e) =>
                      setQuestionTypes((current) =>
                        e.target.checked
                          ? [...current, item.value]
                          : current.filter((value) => value !== item.value),
                      )
                    }
                  />{" "}
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-2">
            <legend className="font-bold">Nguồn nội dung</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <SourceButton
                selected={sourceType === "prompt"}
                onClick={() => setSourceType("prompt")}
                icon={BrainCircuit}
                label="Theo mô tả chủ đề"
              />
              <SourceButton
                selected={sourceType === "upload"}
                onClick={() => setSourceType("upload")}
                icon={FileText}
                label="Tải tài liệu lên"
              />
            </div>
          </fieldset>
          {sourceType === "upload" ? (
            <Field label="Tài liệu nguồn" wide>
              <input
                type="file"
                required
                accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
                className={INPUT_CLASS}
              />
              <span className="mt-2 block text-sm font-semibold text-muted-foreground">
                Hỗ trợ TXT, DOCX, PDF; tối đa 50 MB. Tệp chỉ được đọc trong yêu
                cầu này và được lưu tạm trong lúc job đang chạy.
              </span>
            </Field>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive-soft p-3 font-bold sm:col-span-2"
            >
              {error}
            </p>
          ) : null}
        </section>
        <aside className="rounded-2xl border border-divider bg-surface-soft p-5 lg:sticky lg:top-5">
          <Sparkles className="h-8 w-8" aria-hidden="true" />
          <h2 className="mt-3 font-display text-2xl font-bold">
            Quy trình có kiểm soát
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 font-semibold text-muted-foreground">
            <li>Credit được giữ chỗ trước khi gọi AI.</li>
            <li>Nếu provider lỗi, credit được hoàn tự động.</li>
            <li>Hoạt động luôn được tạo ở trạng thái bản nháp.</li>
          </ul>
          <button
            disabled={
              busy ||
              !questionTypes.length ||
              (sourceType === "upload" && !sourceFile)
            }
            className={`${PRIMARY_ACTION_CLASS} mt-5 w-full`}
          >
            {busy ? (
              <LoaderCircle
                className="h-5 w-5 motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            )}
            {busy ? "AI đang chuẩn bị bản nháp..." : "Tạo bản nháp bằng AI"}
          </button>
          {busy ? (
            <GenerationProgressPanel
              sourceType={sourceType}
              progress={jobProgress}
            />
          ) : null}
        </aside>
      </form>
    </TeacherClassroomFrame>
  );
}

function GenerationProgressPanel({
  sourceType,
  progress,
}: {
  sourceType: "prompt" | "upload";
  progress: AiGenerationJob | null;
}) {
  const total = progress?.documentTotalPages ?? null;
  const processed = total
    ? Math.min(progress?.documentProcessedPages ?? 0, total)
    : (progress?.documentProcessedPages ?? 0);
  const percent = generationProgressPercent(sourceType, progress);
  const copy = generationProgressCopy(sourceType, progress, processed, total);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mt-4 rounded-xl border border-divider bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary">
          <LoaderCircle
            className="h-5 w-5 motion-safe:animate-spin"
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-extrabold tabular-nums">{copy.title}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold">
              <span
                className="h-2 w-2 rounded-full bg-success"
                aria-hidden="true"
              />
              Đang xử lý
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {copy.detail}
          </p>
        </div>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full border border-foreground/20 bg-background"
        role="progressbar"
        aria-label="Tiến độ sinh quiz"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-xs font-bold text-muted-foreground">
        Job chạy nền và tự thử lại khi provider bận. Bạn có thể rời trang rồi
        quay lại xem tiến độ.
      </p>
    </div>
  );
}

function generationProgressCopy(
  sourceType: "prompt" | "upload",
  progress: AiGenerationJob | null,
  processed: number,
  total: number | null,
): { title: string; detail: string } {
  if (sourceType === "prompt") {
    return progress?.stage === "saving_quiz"
      ? {
          title: "Đang lưu quiz bản nháp...",
          detail: "Các câu hỏi đã tạo đang được lưu vào quiz.",
        }
      : {
          title: "AI đang soạn câu hỏi...",
          detail: "AI đang phân tích chủ đề và tạo nội dung quiz.",
        };
  }

  if (!progress || progress.stage === "queued") {
    return {
      title:
        progress?.attemptCount && progress.attemptCount > 0
          ? `Đang tự thử lại lần ${progress.attemptCount + 1}...`
          : "Đang xếp hàng xử lý...",
      detail:
        progress?.errorMessage ||
        "Tài liệu đã được lưu an toàn và đang chờ AI worker xử lý.",
    };
  }

  const pageLabel = total
    ? `Đã đọc ${processed}/${total} trang`
    : "Đang đọc tài liệu...";
  if (progress.stage === "generating_quiz") {
    return {
      title: pageLabel,
      detail: "Đã trích xuất nội dung và đang soạn câu hỏi bằng AI.",
    };
  }
  if (progress.stage === "analyzing_document") {
    const chunkTotal = progress.generationTotalChunks ?? 0;
    const chunkProcessed = Math.min(
      progress.generationProcessedChunks,
      chunkTotal,
    );
    return {
      title: chunkTotal
        ? `Đã phân tích ${chunkProcessed}/${chunkTotal} phần`
        : "Đang phân tích trọng tâm tài liệu...",
      detail:
        "AI đang nhận diện kiến thức cốt lõi và loại bìa, bản quyền, mục lục cùng chi tiết hành chính.",
    };
  }
  if (progress.stage === "planning_quiz") {
    return {
      title: "Đang lập ma trận quiz...",
      detail:
        "Hệ thống đang phân bổ mục tiêu học tập và mức tư duy 20% ghi nhớ, 50% hiểu, 30% vận dụng.",
    };
  }
  if (progress.stage === "generating_candidates") {
    const chunkTotal = progress.generationTotalChunks ?? 0;
    const chunkProcessed = Math.min(
      progress.generationProcessedChunks,
      chunkTotal,
    );
    return {
      title: chunkTotal
        ? `Đã phân tích ${chunkProcessed}/${chunkTotal} phần`
        : "Đang chia tài liệu thành các phần...",
      detail:
        "AI đang tạo câu hỏi ứng viên theo từng phần và giữ checkpoint sau mỗi phần.",
    };
  }
  if (progress.stage === "selecting_questions") {
    return {
      title: "Đang chọn bộ câu hỏi tốt nhất...",
      detail:
        "Hệ thống đang phân bổ câu hỏi xuyên suốt tài liệu và loại nội dung trùng lặp.",
    };
  }
  if (progress.stage === "reviewing_questions") {
    return {
      title: "Đang kiểm định bộ câu hỏi...",
      detail:
        "AI đang loại câu lệch trọng tâm, kiểm tra bằng chứng, distractor và chất lượng phần giải thích.",
    };
  }
  if (progress.stage === "saving_quiz") {
    return {
      title: pageLabel,
      detail: "Các câu hỏi đã tạo đang được lưu vào quiz bản nháp.",
    };
  }
  return {
    title: pageLabel,
    detail: total
      ? "Hệ thống đang xử lý lần lượt từng trang của tài liệu."
      : "Hệ thống đang trích xuất nội dung tài liệu.",
  };
}

function generationProgressPercent(
  sourceType: "prompt" | "upload",
  progress: AiGenerationJob | null,
): number {
  if (!progress) return 2;
  if (progress.stage === "completed") return 100;
  if (progress.stage === "saving_quiz") return 98;
  if (progress.stage === "reviewing_questions") return 94;
  if (progress.stage === "selecting_questions") return 92;
  if (progress.stage === "planning_quiz") return 58;
  if (progress.stage === "generating_quiz")
    return sourceType === "upload" ? 94 : 55;
  if (progress.stage === "generating_candidates") {
    const total = progress.generationTotalChunks ?? 0;
    const ratio = total ? progress.generationProcessedChunks / total : 0;
    return Math.round(60 + Math.min(1, ratio) * 28);
  }
  if (progress.stage === "analyzing_document") {
    const total = progress.generationTotalChunks ?? 0;
    const ratio = total ? progress.generationProcessedChunks / total : 0;
    return Math.round(35 + Math.min(1, ratio) * 20);
  }
  if (progress.stage === "reading_document") {
    const total = progress.documentTotalPages ?? 0;
    const ratio = total ? progress.documentProcessedPages / total : 0;
    return Math.round(5 + Math.min(1, ratio) * 28);
  }
  return 2;
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block font-extrabold ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
function SourceButton({
  selected,
  onClick,
  icon: Icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof BrainCircuit;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-4 text-left font-bold transition-colors ${selected ? "border-foreground bg-primary-soft" : "border-divider bg-surface hover:border-foreground/40 hover:bg-surface-soft"}`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}
