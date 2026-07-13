"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Coins, FileText, Sparkles } from "lucide-react";
import type { AiCreditAccount, QuizQuestionType } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { teacherQuizRoute } from "@/config/routes";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import {
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
  TeacherClassroomFrame,
} from "@/components/classroom/classroom-ui";
import { generateQuizWithAi, getMyAiCredit } from "./ai-api";

const TYPES: Array<{ value: QuizQuestionType; label: string }> = [
  { value: "single_choice", label: "Một đáp án" },
  { value: "true_false", label: "Đúng / Sai" },
  { value: "multiple_choice", label: "Nhiều đáp án" },
];

export function AiQuizGenerator() {
  const { accessToken } = useAuth();
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
  const [questionTypes, setQuestionTypes] = useState<QuizQuestionType[]>(
    TYPES.map((item) => item.value),
  );
  const [sourceType, setSourceType] = useState<"prompt" | "upload">("prompt");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    getMyAiCredit(accessToken)
      .then(setCredit)
      .catch((cause) => setError(getErrorMessage(cause)));
  }, [accessToken]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !accessToken) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await generateQuizWithAi(
        {
          title,
          description,
          topic,
          language: "vi",
          difficulty,
          questionCount,
          questionTypes,
          sourceType,
        },
        sourceType === "upload" ? (sourceFile ?? undefined) : undefined,
        accessToken,
      );
      router.push(teacherQuizRoute(result.quiz.id));
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <TeacherClassroomFrame>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-extrabold uppercase tracking-wide text-muted-foreground">
            Phase 2 · AI Generator
          </p>
          <h1 className="font-display text-4xl font-extrabold">
            Sinh quiz bằng AI
          </h1>
          <p className="mt-2 max-w-2xl font-semibold text-muted-foreground">
            AI tạo bản nháp để bạn kiểm tra và chỉnh sửa trước khi phát hành.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border-2 border-foreground bg-warning-soft px-4 py-3 shadow-brutal-sm">
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
        <section className="grid gap-5 rounded-2xl border-2 border-foreground bg-surface p-6 shadow-brutal-lg sm:grid-cols-2">
          <Field label="Tiêu đề quiz">
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
            <legend className="font-extrabold">Loại câu hỏi</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {TYPES.map((item) => (
                <label
                  key={item.value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-foreground bg-surface-soft px-3 py-2 font-bold"
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
            <legend className="font-extrabold">Nguồn nội dung</legend>
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
                Hỗ trợ TXT, DOCX, PDF; tối đa 10 MB. Tệp chỉ được đọc trong yêu
                cầu này.
              </span>
            </Field>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-xl border-2 border-foreground bg-destructive-soft p-3 font-bold sm:col-span-2"
            >
              {error}
            </p>
          ) : null}
        </section>
        <aside className="rounded-2xl border-2 border-foreground bg-secondary-soft p-5 shadow-brutal-md lg:sticky lg:top-5">
          <Sparkles className="h-8 w-8" aria-hidden="true" />
          <h2 className="mt-3 font-display text-2xl font-extrabold">
            Trước khi tạo
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 font-semibold text-muted-foreground">
            <li>Credit được giữ chỗ trước khi gọi AI.</li>
            <li>Nếu provider lỗi, credit được hoàn tự động.</li>
            <li>Quiz luôn ở trạng thái bản nháp.</li>
          </ul>
          <button
            disabled={
              busy ||
              !questionTypes.length ||
              (sourceType === "upload" && !sourceFile)
            }
            className={`${PRIMARY_ACTION_CLASS} mt-5 w-full`}
          >
            <Sparkles className="h-5 w-5" />
            {busy ? "AI đang soạn quiz..." : "Sinh quiz bằng AI"}
          </button>
          {busy ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-3 text-sm font-bold"
            >
              Quá trình có thể mất tới 2 phút. Vui lòng giữ trang này mở.
            </p>
          ) : null}
        </aside>
      </form>
    </TeacherClassroomFrame>
  );
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
      className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 border-foreground px-4 text-left font-extrabold transition-colors ${selected ? "bg-primary" : "bg-surface hover:bg-surface-soft"}`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}
