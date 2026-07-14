"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ExternalLink,
  FileQuestion,
  ListChecks,
  Send,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import type {
  ConfigureQuizRequest,
  QuizDetail,
  QuizQuestion,
  QuizResultRow,
} from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { publicQuizRoute } from "@/config/routes";
import {
  TeacherClassroomFrame,
  ClassroomErrorState,
  ClassroomLoadingState,
  DANGER_ACTION_CLASS,
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import {
  getClassroom,
  getTeacherClassrooms,
} from "@/components/classroom/classroom-api";
import { QuizQuestionForm } from "./quiz-question-form";
import { TeacherQuizResults } from "./teacher-quiz-results";
import {
  addQuizAssignment,
  addQuizQuestion,
  configureQuiz,
  deleteQuizAssignment,
  deleteQuizQuestion,
  enqueueQuizAssignedNotifications,
  enqueueQuizDeadlineNotifications,
  getQuiz,
  getQuizResults,
  publishQuiz,
  reorderQuizQuestions,
  updateQuiz,
  updateQuizQuestion,
} from "./quiz-api";

type Tab = "questions" | "config" | "distribution" | "results";
export function QuizEditor({ quizId }: { quizId: string }) {
  const { accessToken } = useAuth();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("questions");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<QuizQuestion | null>(null);
  const [results, setResults] = useState<QuizResultRow[]>([]);
  const [assignmentTargets, setAssignmentTargets] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const load = useCallback(async () => {
    try {
      setQuiz(await getQuiz(quizId, accessToken ?? undefined));
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }, [accessToken, quizId]);
  useEffect(() => {
    let active = true;
    getQuiz(quizId, accessToken ?? undefined)
      .then((data) => {
        if (active) setQuiz(data);
      })
      .catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [accessToken, quizId]);
  async function action(run: () => Promise<QuizDetail>) {
    setBusy(true);
    setError("");
    try {
      setQuiz(await run());
      setEditing(null);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (tab === "results" && accessToken)
      getQuizResults(quizId, accessToken)
        .then(setResults)
        .catch((cause) => setError(getErrorMessage(cause)));
  }, [accessToken, quizId, tab]);
  useEffect(() => {
    if (tab !== "distribution" || !accessToken || quiz?.visibility === "public")
      return;
    let active = true;
    getTeacherClassrooms(accessToken)
      .then(async (classrooms) => {
        if (quiz?.visibility === "private_class") {
          return classrooms.map((classroom) => ({
            id: classroom.id,
            name: classroom.name,
          }));
        }
        const details = await Promise.all(
          classrooms.map((classroom) =>
            getClassroom(classroom.id, accessToken),
          ),
        );
        const students = new Map<string, string>();
        details.forEach((classroom) =>
          classroom.members.forEach((member) =>
            students.set(member.userId, member.fullName),
          ),
        );
        return [...students].map(([id, name]) => ({ id, name }));
      })
      .then((targets) => {
        if (active) setAssignmentTargets(targets);
      })
      .catch((cause) => {
        if (active) setError(getErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [accessToken, quiz?.visibility, tab]);
  if (!quiz && !error)
    return (
      <TeacherClassroomFrame>
        <ClassroomLoadingState label="Đang mở trình soạn quiz..." />
      </TeacherClassroomFrame>
    );
  if (!quiz)
    return (
      <TeacherClassroomFrame>
        <ClassroomErrorState message={error} onRetry={() => void load()} />
      </TeacherClassroomFrame>
    );
  const tabs: Array<[Tab, string, typeof BookOpen]> = [
    ["questions", "Câu hỏi", FileQuestion],
    ["config", "Cấu hình", Settings2],
    ["distribution", "Phân phối", Users],
    ["results", "Kết quả", ListChecks],
  ];
  return (
    <TeacherClassroomFrame>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-extrabold uppercase text-muted-foreground">
            {quiz.status === "published" ? "Đã phát hành" : "Bản nháp"}
          </p>
          <h1 className="font-display text-4xl font-extrabold">{quiz.title}</h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            {quiz.description || "Chưa có mô tả"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={publicQuizRoute(quiz.id)}
            target="_blank"
            className={SECONDARY_ACTION_CLASS}
          >
            <ExternalLink className="h-4 w-4" />
            Xem trang làm bài
          </Link>
          <button
            onClick={() =>
              void action(() =>
                publishQuiz(
                  quiz.id,
                  quiz.status !== "published",
                  accessToken ?? undefined,
                ),
              )
            }
            className={PRIMARY_ACTION_CLASS}
          >
            <Send className="h-4 w-4" />
            {quiz.status === "published" ? "Thu hồi" : "Phát hành"}
          </button>
        </div>
      </header>
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-xl border-2 border-foreground bg-destructive-soft p-3 font-bold"
        >
          {error}
        </p>
      ) : null}
      <nav
        role="tablist"
        className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border-2 border-foreground bg-surface p-2"
      >
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 font-extrabold ${tab === id ? "border-2 border-foreground bg-primary" : "text-muted-foreground"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
      {tab === "questions" ? (
        <section className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-3">
            {quiz.questions.map((question, index) => (
              <article
                key={question.id}
                className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-sm"
              >
                <div className="flex gap-3">
                  <span className="font-display text-xl font-extrabold">
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-extrabold">{question.content}</h2>
                    <p className="mt-1 text-sm font-bold text-muted-foreground">
                      {question.score} điểm · {question.options.length} lựa chọn
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setEditing(question)}
                    className={SECONDARY_ACTION_CLASS}
                  >
                    Sửa
                  </button>
                  <button
                    disabled={index === 0 || busy}
                    onClick={() => {
                      const ids = quiz.questions.map((q) => q.id);
                      [ids[index - 1], ids[index]] = [
                        ids[index],
                        ids[index - 1],
                      ];
                      void action(() =>
                        reorderQuizQuestions(
                          quiz.id,
                          ids,
                          accessToken ?? undefined,
                        ),
                      );
                    }}
                    className={SECONDARY_ACTION_CLASS}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    disabled={index === quiz.questions.length - 1 || busy}
                    onClick={() => {
                      const ids = quiz.questions.map((q) => q.id);
                      [ids[index + 1], ids[index]] = [
                        ids[index],
                        ids[index + 1],
                      ];
                      void action(() =>
                        reorderQuizQuestions(
                          quiz.id,
                          ids,
                          accessToken ?? undefined,
                        ),
                      );
                    }}
                    className={SECONDARY_ACTION_CLASS}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      void action(() =>
                        deleteQuizQuestion(
                          quiz.id,
                          question.id,
                          accessToken ?? undefined,
                        ),
                      )
                    }
                    className={DANGER_ACTION_CLASS}
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa
                  </button>
                </div>
              </article>
            ))}
            {quiz.questions.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-foreground p-8 text-center font-bold">
                Chưa có câu hỏi.
              </div>
            ) : null}
          </div>
          <QuizQuestionForm
            key={editing?.id ?? "new-question"}
            initial={editing}
            busy={busy}
            onCancel={editing ? () => setEditing(null) : undefined}
            onSave={(input) =>
              void action(() =>
                editing
                  ? updateQuizQuestion(
                      quiz.id,
                      editing.id,
                      input,
                      accessToken ?? undefined,
                    )
                  : addQuizQuestion(quiz.id, input, accessToken ?? undefined),
              )
            }
          />
        </section>
      ) : null}
      {tab === "config" ? (
        <QuizConfig
          quiz={quiz}
          busy={busy}
          onSave={(input) =>
            void action(async () => {
              if (input.title || input.description !== undefined)
                await updateQuiz(
                  quiz.id,
                  { title: input.title, description: input.description },
                  accessToken ?? undefined,
                );
              return configureQuiz(
                quiz.id,
                input.config,
                accessToken ?? undefined,
              );
            })
          }
        />
      ) : null}
      {tab === "distribution" ? (
        <QuizDistribution
          quiz={quiz}
          busy={busy}
          targets={assignmentTargets}
          onAdd={(targetId) =>
            void action(async () => {
              await addQuizAssignment(
                quiz.id,
                {
                  targetType:
                    quiz.visibility === "private_class"
                      ? "classroom"
                      : "student",
                  targetId,
                },
                accessToken ?? undefined,
              );
              return getQuiz(quiz.id, accessToken ?? undefined);
            })
          }
          onDelete={(id) =>
            void action(async () => {
              await deleteQuizAssignment(quiz.id, id, accessToken ?? undefined);
              return getQuiz(quiz.id, accessToken ?? undefined);
            })
          }
          onNotify={async (kind) => {
            const summary = await (kind === "assigned"
              ? enqueueQuizAssignedNotifications(
                  quiz.id,
                  accessToken ?? undefined,
                )
              : enqueueQuizDeadlineNotifications(
                  quiz.id,
                  accessToken ?? undefined,
                ));
            return `Đã xếp hàng ${summary.queued} email; ${summary.alreadyQueued} email đã tồn tại.`;
          }}
        />
      ) : null}
      {tab === "results" ? (
        <TeacherQuizResults
          quiz={quiz}
          results={results}
          onReload={async () => {
            await load();
            setResults(await getQuizResults(quiz.id, accessToken ?? undefined));
          }}
        />
      ) : null}
    </TeacherClassroomFrame>
  );
}

function QuizConfig({
  quiz,
  busy,
  onSave,
}: {
  quiz: QuizDetail;
  busy: boolean;
  onSave: (input: {
    title?: string;
    description?: string;
    config: ConfigureQuizRequest;
  }) => void;
}) {
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description ?? "");
  const [totalScore, setTotalScore] = useState(quiz.totalScore);
  const [visibility, setVisibility] = useState(quiz.visibility);
  const [timeLimit, setTimeLimit] = useState(
    quiz.timeLimitSeconds?.toString() ?? "",
  );
  const [maxAttempts, setMaxAttempts] = useState(
    quiz.maxAttempts?.toString() ?? "",
  );
  const [opensAt, setOpensAt] = useState(quiz.opensAt?.slice(0, 16) ?? "");
  const [dueAt, setDueAt] = useState(quiz.dueAt?.slice(0, 16) ?? "");
  const [leaderboardMode, setLeaderboardMode] = useState(quiz.leaderboardMode);
  const [resultReleaseMode, setResultReleaseMode] = useState(
    quiz.resultReleaseMode,
  );
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(
    quiz.showCorrectAnswers,
  );
  const [showExplanations, setShowExplanations] = useState(
    quiz.showExplanations,
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          title,
          description,
          config: {
            totalScore: totalScore as 10 | 100 | 1000,
            visibility,
            timeLimitSeconds: timeLimit ? Number(timeLimit) : null,
            maxAttempts: maxAttempts ? Number(maxAttempts) : null,
            opensAt: opensAt ? new Date(opensAt).toISOString() : null,
            dueAt: dueAt ? new Date(dueAt).toISOString() : null,
            leaderboardMode,
            resultReleaseMode,
            showCorrectAnswers,
            showExplanations,
          },
        });
      }}
      className="grid gap-5 rounded-2xl border-2 border-foreground bg-surface p-6 shadow-brutal-md md:grid-cols-2"
    >
      <Field label="Tiêu đề">
        <input
          className={INPUT_CLASS}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Tổng điểm">
        <select
          className={INPUT_CLASS}
          value={totalScore}
          onChange={(e) => setTotalScore(Number(e.target.value))}
        >
          <option>10</option>
          <option>100</option>
          <option>1000</option>
        </select>
      </Field>
      <Field label="Mô tả">
        <textarea
          className={INPUT_CLASS}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="Phạm vi">
        <select
          className={INPUT_CLASS}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as typeof visibility)}
        >
          <option value="private_class">Theo lớp</option>
          <option value="assigned">Gán học sinh</option>
          <option value="public">Công khai</option>
        </select>
      </Field>
      <Field label="Giới hạn thời gian (giây)">
        <input
          type="number"
          min="1"
          className={INPUT_CLASS}
          value={timeLimit}
          onChange={(e) => setTimeLimit(e.target.value)}
        />
      </Field>
      <Field label="Số lượt (trống = không giới hạn)">
        <input
          type="number"
          min="1"
          className={INPUT_CLASS}
          value={maxAttempts}
          onChange={(e) => setMaxAttempts(e.target.value)}
        />
      </Field>
      <Field label="Mở lúc">
        <input
          type="datetime-local"
          className={INPUT_CLASS}
          value={opensAt}
          onChange={(e) => setOpensAt(e.target.value)}
        />
      </Field>
      <Field label="Hạn nộp">
        <input
          type="datetime-local"
          className={INPUT_CLASS}
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </Field>
      <Field label="Leaderboard">
        <select
          className={INPUT_CLASS}
          value={leaderboardMode}
          onChange={(e) =>
            setLeaderboardMode(e.target.value as typeof leaderboardMode)
          }
        >
          <option value="hidden">Ẩn</option>
          <option value="visible_anonymized">Hiện ẩn danh</option>
        </select>
      </Field>
      <Field label="Công bố điểm">
        <select
          className={INPUT_CLASS}
          value={resultReleaseMode}
          onChange={(e) =>
            setResultReleaseMode(e.target.value as typeof resultReleaseMode)
          }
        >
          <option value="immediately">Ngay sau khi nộp</option>
          <option value="after_due">Sau hạn nộp</option>
          <option value="hidden">Chỉ giáo viên xem</option>
        </select>
      </Field>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-foreground bg-surface-soft p-4 font-extrabold">
        <input
          type="checkbox"
          checked={showCorrectAnswers}
          onChange={(e) => setShowCorrectAnswers(e.target.checked)}
        />
        Hiển thị đáp án đúng khi công bố
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-foreground bg-surface-soft p-4 font-extrabold">
        <input
          type="checkbox"
          checked={showExplanations}
          onChange={(e) => setShowExplanations(e.target.checked)}
        />
        Hiển thị lời giải khi công bố
      </label>
      <button disabled={busy} className={`${PRIMARY_ACTION_CLASS} self-end`}>
        Lưu cấu hình
      </button>
    </form>
  );
}
function QuizDistribution({
  quiz,
  busy,
  targets,
  onAdd,
  onDelete,
  onNotify,
}: {
  quiz: QuizDetail;
  busy: boolean;
  targets: Array<{ id: string; name: string }>;
  onAdd: (id: string) => void;
  onDelete: (id: string) => void;
  onNotify: (kind: "assigned" | "deadline") => Promise<string>;
}) {
  const [targetId, setTargetId] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function notify(kind: "assigned" | "deadline") {
    setNotificationBusy(true);
    try {
      setNotice(await onNotify(kind));
    } catch (cause) {
      setNotice(getErrorMessage(cause));
    } finally {
      setNotificationBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border-2 border-foreground bg-surface p-6">
      <h2 className="font-display text-2xl font-extrabold">Phân phối quiz</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={notificationBusy || !quiz.assignments.length}
          onClick={() => void notify("assigned")}
          className={SECONDARY_ACTION_CLASS}
        >
          Gửi thông báo quiz mới
        </button>
        <button
          type="button"
          disabled={notificationBusy || !quiz.assignments.length || !quiz.dueAt}
          onClick={() => void notify("deadline")}
          className={SECONDARY_ACTION_CLASS}
        >
          Lên lịch nhắc trước hạn 24 giờ
        </button>
      </div>
      {notice ? (
        <p
          role="status"
          className="mt-3 rounded-xl border-2 border-foreground bg-success-soft p-3 font-bold"
        >
          {notice}
        </p>
      ) : null}
      {quiz.visibility === "public" ? (
        <p className="mt-3 font-bold text-muted-foreground">
          Quiz công khai không cần gán đối tượng.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (targetId) onAdd(targetId);
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <select
            className={INPUT_CLASS}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">
              {quiz.visibility === "private_class"
                ? "Chọn lớp học"
                : "Chọn học sinh"}
            </option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
          <button disabled={busy} className={PRIMARY_ACTION_CLASS}>
            Gán
          </button>
        </form>
      )}
      <ul className="mt-5 space-y-2">
        {quiz.assignments.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-xl border-2 p-3"
          >
            <span className="font-bold">{item.targetName}</span>
            <button
              onClick={() => onDelete(item.id)}
              className={DANGER_ACTION_CLASS}
            >
              Xóa
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block font-extrabold">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
