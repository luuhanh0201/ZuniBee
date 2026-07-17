"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle2,
  CircleHelp,
  Eye,
  EyeOff,
  Headphones,
  Lightbulb,
  ListChecks,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import {
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import {
  MOCK_CONTEXT_EXCERPT,
  MOCK_FILL_BLANKS,
  MOCK_GRAMMAR,
  MOCK_LESSON_COURSE,
  MOCK_LISTENING,
  MOCK_QUIZZES,
  MOCK_VOCABULARY,
  MOCK_WRITING,
  type LessonActivity,
  type LessonActivityKind,
} from "./lesson-mock-data";

export const ACTIVITY_KIND_LABELS: Record<LessonActivityKind, string> = {
  overview: "Đọc hiểu",
  flashcards: "Flashcard",
  quiz: "Quiz",
  grammar: "Bài giảng",
  fill_blank: "Điền từ",
  listening: "Bài nghe",
  writing: "Bài viết",
  reflection: "Tự đánh giá",
};

export function LessonActivityContent({
  activity,
}: {
  activity: LessonActivity;
}) {
  if (activity.kind === "overview") return <OverviewActivity />;
  if (activity.kind === "flashcards") return <FlashcardActivity />;
  if (activity.kind === "quiz") return <QuizActivity activityId={activity.id} />;
  if (activity.kind === "grammar") return <GrammarActivity />;
  if (activity.kind === "fill_blank") return <FillBlankActivity />;
  if (activity.kind === "listening") return <ListeningActivity />;
  if (activity.kind === "writing") return <WritingActivity />;
  return <ReflectionActivity />;
}

function OverviewActivity() {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-6 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
      <section className="min-w-0">
        <div className="flex items-start gap-3 rounded-2xl bg-secondary-soft p-4">
          <Sparkles
            className="mt-0.5 h-5 w-5 shrink-0 text-purple"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Đọc có mục tiêu</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Gạch dưới các từ mô tả thói quen, lịch sinh hoạt và sự thay đổi
              giữa các thế hệ.
            </p>
          </div>
        </div>
        <article className="mt-5 min-w-0 max-w-full overflow-hidden rounded-2xl border border-divider bg-surface-soft p-5 sm:p-6">
          <p className="editorial-label">Đoạn trích từ tài liệu</p>
          <h3 className="mt-2 break-words font-display text-2xl font-bold">
            {MOCK_CONTEXT_EXCERPT.title}
          </h3>
          <div className="mt-5 min-w-0 space-y-4 break-words leading-8 text-muted-foreground">
            {MOCK_CONTEXT_EXCERPT.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {MOCK_CONTEXT_EXCERPT.highlightedTerms.map((term) => (
              <span
                key={term}
                className="rounded-lg border border-primary/50 bg-primary/25 px-2.5 py-1 text-sm font-semibold"
              >
                {term}
              </span>
            ))}
          </div>
        </article>
      </section>
      <aside className="min-w-0 rounded-2xl border border-divider bg-surface p-5 sm:p-6">
        <BookOpenText
          className="h-7 w-7 text-secondary-strong"
          aria-hidden="true"
        />
        <h3 className="mt-3 font-display text-xl font-bold">
          Mục tiêu của bài học
        </h3>
        <ul className="mt-4 space-y-3 text-sm">
          {MOCK_LESSON_COURSE.objectives.map((objective) => (
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
        <div className="mt-6 rounded-xl border border-purple/25 bg-purple-soft p-4 text-sm">
          <p className="font-semibold text-purple">AI đã làm gì?</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            Nhận diện từ khóa và trích đoạn từ trang 42–43. Giáo viên đã kiểm
            tra lại phạm vi trước khi đưa vào bài học.
          </p>
        </div>
      </aside>
    </div>
  );
}

function FlashcardActivity() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownWords, setKnownWords] = useState<string[]>([]);
  const item = MOCK_VOCABULARY[index];

  function move(nextIndex: number) {
    setIndex(nextIndex);
    setFlipped(false);
  }

  function markKnown() {
    setKnownWords((current) =>
      current.includes(item.word) ? current : [...current, item.word],
    );
    if (index < MOCK_VOCABULARY.length - 1) move(index + 1);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="editorial-label">Bộ thẻ Unit 6</p>
          <h3 className="mt-1 font-display text-2xl font-bold">
            Lifestyle words
          </h3>
        </div>
        <span className="rounded-full border border-divider bg-surface-soft px-3 py-1.5 text-sm font-semibold tabular-nums">
          Đã nhớ {knownWords.length}/{MOCK_VOCABULARY.length}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((current) => !current)}
        aria-label={flipped ? "Xem mặt trước flashcard" : "Lật flashcard để xem nghĩa"}
        className="mt-6 flex min-h-80 w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-foreground bg-primary/25 p-7 text-center shadow-brutal-sm transition-[background-color,box-shadow] duration-200 hover:bg-primary/35 hover:shadow-brutal-md focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
      >
        {flipped ? (
          <>
            <p className="editorial-label">Nghĩa và ngữ cảnh</p>
            <p className="mt-4 font-display text-4xl font-bold">{item.meaning}</p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {item.example}
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold">
              <EyeOff className="h-4 w-4" aria-hidden="true" />
              Chạm để quay lại từ
            </span>
          </>
        ) : (
          <>
            <p className="editorial-label">Từ {index + 1}</p>
            <p className="mt-4 font-display text-5xl font-bold sm:text-6xl">
              {item.word}
            </p>
            <p className="mt-4 text-lg font-semibold text-secondary-strong">
              {item.pronunciation}
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold">
              <Eye className="h-4 w-4" aria-hidden="true" />
              Chạm để xem nghĩa
            </span>
          </>
        )}
      </button>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => move(Math.max(0, index - 1))}
          disabled={index === 0}
          className={SECONDARY_ACTION_CLASS}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Thẻ trước
        </button>
        <div className="flex flex-wrap justify-center gap-2" aria-label="Chọn flashcard">
          {MOCK_VOCABULARY.map((word, wordIndex) => (
            <button
              key={word.word}
              type="button"
              onClick={() => move(wordIndex)}
              aria-label={`Mở thẻ ${wordIndex + 1}: ${word.word}`}
              aria-current={wordIndex === index ? "step" : undefined}
              className={`h-3 w-3 cursor-pointer rounded-full border border-foreground/30 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ${wordIndex === index ? "bg-primary" : knownWords.includes(word.word) ? "bg-success" : "bg-surface-soft"}`}
            />
          ))}
        </div>
        {flipped ? (
          <button type="button" onClick={markKnown} className={PRIMARY_ACTION_CLASS}>
            <Check className="h-5 w-5" aria-hidden="true" />
            Tôi đã nhớ
          </button>
        ) : (
          <button
            type="button"
            onClick={() => move(Math.min(MOCK_VOCABULARY.length - 1, index + 1))}
            disabled={index === MOCK_VOCABULARY.length - 1}
            className={SECONDARY_ACTION_CLASS}
          >
            Thẻ tiếp
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

function QuizActivity({ activityId }: { activityId: string }) {
  const questions = MOCK_QUIZZES[activityId] ?? [];
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const question = questions[questionIndex];
  const selectedAnswer = question ? answers[question.id] : undefined;
  const correctCount = questions.filter(
    (item) => answers[item.id] === item.correctAnswer,
  ).length;

  if (!question) {
    return (
      <p role="status" className="rounded-2xl bg-surface-soft p-5">
        Chưa có câu hỏi mẫu cho hoạt động này.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="editorial-label">
          Câu hỏi {questionIndex + 1} / {questions.length}
        </p>
        <span className="rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold tabular-nums">
          {correctCount} câu đúng
        </span>
      </div>
      <div className="mt-4 flex gap-1" aria-hidden="true">
        {questions.map((item, index) => (
          <span
            key={item.id}
            className={`h-2 flex-1 rounded-full ${index === questionIndex ? "bg-primary" : answers[item.id] !== undefined ? "bg-success" : "bg-surface-soft"}`}
          />
        ))}
      </div>
      <h3 className="mt-7 font-display text-2xl font-bold sm:text-3xl">
        {question.prompt}
      </h3>
      <div className="mt-6 space-y-3">
        {question.answers.map((answer, index) => {
          const selected = selectedAnswer === index;
          const correct = selected && index === question.correctAnswer;
          const incorrect = selected && index !== question.correctAnswer;
          return (
            <button
              key={answer}
              type="button"
              onClick={() =>
                setAnswers((current) => ({
                  ...current,
                  [question.id]: index,
                }))
              }
              aria-pressed={selected}
              className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 text-left font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ${correct ? "border-success bg-success-soft" : incorrect ? "border-destructive bg-destructive-soft" : selected ? "border-foreground bg-primary/20" : "border-divider bg-surface hover:bg-surface-soft"}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-sm">
                {String.fromCharCode(65 + index)}
              </span>
              {answer}
              {correct ? (
                <CheckCircle2 className="ml-auto h-5 w-5 shrink-0" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      {selectedAnswer !== undefined ? (
        <div
          role="status"
          className={`mt-5 rounded-2xl border p-4 ${selectedAnswer === question.correctAnswer ? "border-success/40 bg-success-soft" : "border-destructive/30 bg-destructive-soft"}`}
        >
          <p className="font-semibold">
            {selectedAnswer === question.correctAnswer ? "Chính xác" : "Chưa đúng"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {question.explanation}
          </p>
        </div>
      ) : null}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
          disabled={questionIndex === 0}
          className={SECONDARY_ACTION_CLASS}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Câu trước
        </button>
        <button
          type="button"
          onClick={() =>
            setQuestionIndex((current) =>
              Math.min(questions.length - 1, current + 1),
            )
          }
          disabled={questionIndex === questions.length - 1}
          className={PRIMARY_ACTION_CLASS}
        >
          Câu tiếp
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function GrammarActivity() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.78fr]">
      <section>
        <p className="editorial-label">Cấu trúc trọng tâm</p>
        <h3 className="mt-2 font-display text-3xl font-bold">
          {MOCK_GRAMMAR.title}
        </h3>
        <div className="mt-5 rounded-2xl border-2 border-foreground bg-primary/25 p-5 text-center font-display text-xl font-bold">
          {MOCK_GRAMMAR.formula}
        </div>
        <p className="mt-5 leading-relaxed text-muted-foreground">
          {MOCK_GRAMMAR.explanation}
        </p>
        <div className="mt-6 rounded-2xl border border-divider bg-surface-soft p-5">
          <p className="font-semibold">Ví dụ từ bài học</p>
          <ol className="mt-4 space-y-3 text-sm">
            {MOCK_GRAMMAR.examples.map((example, index) => (
              <li key={example} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary-soft text-xs font-semibold">
                  {index + 1}
                </span>
                {example}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <aside className="rounded-2xl border border-divider bg-secondary-soft p-5 sm:p-6">
        <Lightbulb className="h-7 w-7 text-secondary-strong" aria-hidden="true" />
        <h3 className="mt-3 font-display text-xl font-bold">Ghi nhớ</h3>
        <ul className="mt-4 space-y-4 text-sm leading-relaxed">
          {MOCK_GRAMMAR.notes.map((note) => (
            <li key={note} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} aria-hidden="true" />
              {note}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function FillBlankActivity() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const correctCount = MOCK_FILL_BLANKS.filter(
    (item) =>
      answers[item.id]?.trim().toLocaleLowerCase("en") ===
      item.answer.toLocaleLowerCase("en"),
  ).length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start gap-3 rounded-2xl bg-secondary-soft p-4">
        <ListChecks className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm leading-relaxed">
          Điền dạng so sánh đúng của trạng từ trong ngoặc. Có thể dùng more,
          less hoặc dạng -er.
        </p>
      </div>
      <div className="mt-5 space-y-4">
        {MOCK_FILL_BLANKS.map((item, index) => {
          const correct =
            answers[item.id]?.trim().toLocaleLowerCase("en") ===
            item.answer.toLocaleLowerCase("en");
          return (
            <label
              key={item.id}
              className={`block rounded-2xl border p-4 ${checked ? (correct ? "border-success/40 bg-success-soft" : "border-destructive/30 bg-destructive-soft") : "border-divider bg-surface"}`}
            >
              <span className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-sm font-semibold">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 leading-8">
                  {item.before}{" "}
                  <span className="sr-only">Điền đáp án cho câu {index + 1}</span>
                  <input
                    value={answers[item.id] ?? ""}
                    onChange={(event) => {
                      setAnswers((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }));
                      setChecked(false);
                    }}
                    className="mx-1 inline-block min-h-10 w-full max-w-52 rounded-xl border-2 border-border bg-surface px-3 text-base focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />{" "}
                  {item.after}
                </span>
              </span>
              {checked && !correct ? (
                <span className="mt-2 block pl-11 text-sm font-semibold">
                  Đáp án: {item.answer}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold" role="status">
          {checked ? `${correctCount}/${MOCK_FILL_BLANKS.length} câu đúng` : "Hoàn thành tất cả câu rồi kiểm tra đáp án."}
        </p>
        <button
          type="button"
          onClick={() => setChecked(true)}
          className={PRIMARY_ACTION_CLASS}
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          Kiểm tra đáp án
        </button>
      </div>
    </div>
  );
}

function ListeningActivity() {
  const [playing, setPlaying] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [notes, setNotes] = useState("");

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <section className="rounded-3xl border border-divider bg-banner p-6 text-white sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <Headphones className="h-7 w-7" aria-hidden="true" />
          </span>
          <span className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/75">
            Audio mô phỏng
          </span>
        </div>
        <p className="mt-7 text-sm font-semibold uppercase tracking-[0.12em] text-white/60">
          {MOCK_LISTENING.speaker}
        </p>
        <h3 className="mt-2 font-display text-2xl font-bold">
          {MOCK_LISTENING.title}
        </h3>
        <p className="mt-2 text-sm text-white/65">
          Bài nghe · {MOCK_LISTENING.duration}
        </p>
        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((current) => !current)}
            aria-label={playing ? "Tạm dừng bài nghe mô phỏng" : "Phát bài nghe mô phỏng"}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            {playing ? (
              <Pause className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <span
                className={`block h-full rounded-full bg-primary transition-[width] duration-300 ${playing ? "w-[68%]" : "w-[42%]"}`}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-white/60 tabular-nums">
              <span>{playing ? "00:57" : "00:35"}</span>
              <span>01:24</span>
            </div>
          </div>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-white/55">
          Prototype chưa phát tệp âm thanh thật; nút trên mô phỏng trạng thái
          player để kiểm tra UI.
        </p>
      </section>

      <section>
        <div className="rounded-2xl border border-secondary/30 bg-secondary-soft p-5">
          <p className="editorial-label">Câu hỏi định hướng</p>
          <p className="mt-2 font-semibold leading-relaxed">
            {MOCK_LISTENING.focusQuestion}
          </p>
        </div>
        <label className="mt-5 block">
          <span className="font-semibold">Ghi chú trong khi nghe</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={MOCK_LISTENING.notePrompts.join(" · ")}
            className="mt-2 min-h-36 w-full rounded-2xl border-2 border-border bg-surface px-4 py-3 text-base placeholder:text-muted-foreground/70 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        <button
          type="button"
          onClick={() => setTranscriptOpen((current) => !current)}
          aria-expanded={transcriptOpen}
          className={`${SECONDARY_ACTION_CLASS} mt-4`}
        >
          <BookOpenText className="h-5 w-5" aria-hidden="true" />
          {transcriptOpen ? "Ẩn transcript" : "Xem transcript"}
        </button>
        {transcriptOpen ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-divider bg-surface-soft p-5 text-sm leading-7 text-muted-foreground">
            {MOCK_LISTENING.transcript.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function WritingActivity() {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
      <section>
        <p className="editorial-label">Writing task</p>
        <h3 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
          My healthier week
        </h3>
        <p className="mt-4 text-lg leading-relaxed">
          {MOCK_WRITING.prompt}
        </p>
        <label className="mt-6 block">
          <span className="flex items-center justify-between gap-3 font-semibold">
            <span>Bài viết của bạn</span>
            <span
              className={`text-sm tabular-nums ${wordCount >= 80 && wordCount <= 100 ? "text-success" : "text-muted-foreground"}`}
            >
              {wordCount}/100 từ
            </span>
          </span>
          <textarea
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setSaved(false);
            }}
            placeholder="I want to change..."
            className="mt-2 min-h-72 w-full rounded-2xl border-2 border-border bg-surface px-4 py-4 text-base leading-7 placeholder:text-muted-foreground/70 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {saved ? (
            <p className="flex items-center gap-2 text-sm font-semibold" role="status">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
              Đã lưu bản nháp mô phỏng
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setSaved(true)}
            disabled={!content.trim()}
            className={PRIMARY_ACTION_CLASS}
          >
            <Save className="h-5 w-5" aria-hidden="true" />
            Lưu bài viết
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-divider bg-surface-soft p-5">
          <CircleHelp className="h-6 w-6 text-secondary-strong" aria-hidden="true" />
          <h3 className="mt-3 font-display text-xl font-bold">Câu hỏi gợi ý</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {MOCK_WRITING.guidingQuestions.map((question) => (
              <li key={question} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary-strong" />
                {question}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-divider bg-warning-soft p-5">
          <h3 className="font-display text-lg font-bold">Checklist trước khi nộp</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {MOCK_WRITING.requirements.map((requirement) => (
              <li key={requirement} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} aria-hidden="true" />
                {requirement}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setOutlineOpen((current) => !current)}
          aria-expanded={outlineOpen}
          className={`${SECONDARY_ACTION_CLASS} w-full`}
        >
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
          {outlineOpen ? "Ẩn dàn ý mẫu" : "Xem dàn ý mẫu"}
        </button>
        {outlineOpen ? (
          <ol className="space-y-2 rounded-2xl border border-purple/25 bg-purple-soft p-5 text-sm">
            {MOCK_WRITING.sampleOutline.map((item, index) => (
              <li key={item}>
                <strong>{index + 1}.</strong> {item}
              </li>
            ))}
          </ol>
        ) : null}
      </aside>
    </div>
  );
}

function ReflectionActivity() {
  const [confidence, setConfidence] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft">
          <RotateCcw className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="editorial-label mt-5">Review & reflect</p>
        <h3 className="mt-2 font-display text-3xl font-bold">
          Bạn đã sẵn sàng áp dụng điều gì?
        </h3>
      </div>
      <fieldset className="mt-7">
        <legend className="font-semibold">
          Mức độ tự tin sau bài học
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {["Cần ôn lại", "Khá tự tin", "Sẵn sàng áp dụng"].map((label) => (
            <label
              key={label}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-4 font-semibold transition-colors ${confidence === label ? "border-foreground bg-primary/25" : "border-divider bg-surface hover:bg-surface-soft"}`}
            >
              <input
                type="radio"
                name="lesson-confidence"
                value={label}
                checked={confidence === label}
                onChange={() => {
                  setConfidence(label);
                  setSaved(false);
                }}
                className="h-4 w-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-6 block">
        <span className="font-semibold">
          Một thay đổi bạn sẽ thử trong tuần này
        </span>
        <textarea
          value={nextAction}
          onChange={(event) => {
            setNextAction(event.target.value);
            setSaved(false);
          }}
          placeholder="Ví dụ: Tôi sẽ không dùng điện thoại sau 10 giờ tối..."
          className="mt-2 min-h-32 w-full rounded-2xl border-2 border-border bg-surface px-4 py-3 text-base placeholder:text-muted-foreground/70 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      </label>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {saved ? (
          <p className="flex items-center gap-2 text-sm font-semibold" role="status">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
            Đã lưu tự đánh giá mô phỏng
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setSaved(true)}
          disabled={!confidence || !nextAction.trim()}
          className={PRIMARY_ACTION_CLASS}
        >
          <PenLine className="h-5 w-5" aria-hidden="true" />
          Lưu tự đánh giá
        </button>
      </div>
    </div>
  );
}
