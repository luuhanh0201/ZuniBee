"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  GraduationCap,
  ListChecks,
  MailPlus,
  PartyPopper,
  Users,
} from "lucide-react";
import type {
  ClassroomDetail,
  ClassroomInviteResult,
  CreateClassroomRequest,
  InviteStudentsResponse,
} from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast-provider";
import { createClassroom, inviteStudents } from "./classroom-api";
import { ClassroomSharePanel } from "./classroom-share-panel";
import {
  ClassroomPageHeader,
  InlineSpinner,
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
  TeacherClassroomFrame,
} from "./classroom-ui";
import { EmailBatchInput } from "./email-batch-input";
import { getErrorMessage, parseEmailBatch } from "./classroom-utils";

type WizardStep = 1 | 2 | 3;

const STEPS = [
  { number: 1, label: "Thông tin lớp", icon: BookOpen },
  { number: 2, label: "Mời sinh viên", icon: Users },
  { number: 3, label: "Chia sẻ lớp", icon: PartyPopper },
] as const;

export function CreateClassroomWizard() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<WizardStep>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
  const [inviteResponse, setInviteResponse] =
    useState<InviteStudentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current) return;

    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      setError("Tên lớp phải có ít nhất 2 ký tự");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const input: CreateClassroomRequest = {
        name: normalizedName,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        ...(grade.trim() ? { grade: grade.trim() } : {}),
      };
      const createdClassroom = await createClassroom(
        input,
        accessToken ?? undefined,
      );
      setClassroom(createdClassroom);
      setStep(2);
      showToast("success", "Đã tạo lớp. Bạn có thể mời sinh viên ngay.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current || !classroom) return;

    const parsed = parseEmailBatch(emailInput);
    if (parsed.invalidEmails.length > 0) {
      setError("Vui lòng sửa các email sai định dạng trước khi tiếp tục");
      return;
    }
    if (parsed.emails.length > 100) {
      setError("Mỗi lần chỉ được mời tối đa 100 email");
      return;
    }
    if (parsed.emails.length === 0) {
      setError(null);
      setStep(3);
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await inviteStudents(
        classroom.id,
        { emails: parsed.emails },
        accessToken ?? undefined,
      );
      setInviteResponse(response);
      setStep(3);
      showToast("success", inviteSuccessMessage(response));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  function skipInvitations() {
    if (submitLockRef.current) return;
    setError(null);
    setStep(3);
  }

  return (
    <TeacherClassroomFrame>
      <ClassroomPageHeader
        title="Tạo lớp học mới"
        description="Thiết lập lớp, mời sinh viên và chia sẻ quyền truy cập trong ba bước ngắn gọn."
        backHref="/teacher/classes"
        backLabel="Về danh sách lớp"
      />

      <WizardProgress currentStep={step} />

      <div className="mx-auto mt-8 max-w-5xl">
        {step === 1 ? (
          <ClassroomDetailsStep
            name={name}
            description={description}
            subject={subject}
            grade={grade}
            error={error}
            isSubmitting={isSubmitting}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onSubjectChange={setSubject}
            onGradeChange={setGrade}
            onSubmit={handleCreate}
          />
        ) : null}

        {step === 2 && classroom ? (
          <InvitationStep
            classroom={classroom}
            emailInput={emailInput}
            error={error}
            isSubmitting={isSubmitting}
            onEmailInputChange={(value) => {
              setEmailInput(value);
              if (error) setError(null);
            }}
            onSubmit={handleInvite}
            onSkip={skipInvitations}
          />
        ) : null}

        {step === 3 && classroom ? (
          <SharingStep classroom={classroom} inviteResponse={inviteResponse} />
        ) : null}
      </div>
    </TeacherClassroomFrame>
  );
}

function WizardProgress({ currentStep }: { currentStep: WizardStep }) {
  return (
    <nav aria-label="Tiến trình tạo lớp" className="mx-auto max-w-5xl">
      <ol className="grid grid-cols-3 gap-2 sm:gap-4">
        {STEPS.map(({ number, label, icon: Icon }) => {
          const isComplete = currentStep > number;
          const isCurrent = currentStep === number;
          return (
            <li
              key={number}
              aria-current={isCurrent ? "step" : undefined}
              className={`relative flex min-w-0 flex-col items-center gap-2 rounded-2xl border-2 px-2 py-3 text-center sm:flex-row sm:justify-center sm:px-4 ${
                isCurrent
                  ? "border-foreground bg-primary shadow-brutal-md"
                  : isComplete
                    ? "border-foreground bg-success-soft shadow-brutal-sm"
                    : "border-border bg-surface text-muted-foreground"
              }`}
            >
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                  isCurrent || isComplete
                    ? "border-foreground bg-surface"
                    : "border-border bg-surface-soft"
                }`}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 text-xs font-extrabold sm:text-sm">
                <span className="sr-only">Bước {number}: </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ClassroomDetailsStep({
  name,
  description,
  subject,
  grade,
  error,
  isSubmitting,
  onNameChange,
  onDescriptionChange,
  onSubjectChange,
  onGradeChange,
  onSubmit,
}: {
  name: string;
  description: string;
  subject: string;
  grade: string;
  error: string | null;
  isSubmitting: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onGradeChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section
      className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-lg sm:p-8"
      aria-labelledby="classroom-details-heading"
    >
      <div className="mb-7 flex items-start gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-secondary shadow-brutal-md">
          <ListChecks className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-extrabold text-secondary-strong">
            Bước 1 / 3
          </p>
          <h2
            id="classroom-details-heading"
            className="font-display text-2xl font-extrabold"
          >
            Thông tin lớp học
          </h2>
          <p className="mt-1 font-semibold text-muted-foreground">
            Tên lớp là bắt buộc. Các thông tin còn lại có thể bổ sung sau.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="classroom-name"
              className="mb-2 block font-extrabold"
            >
              Tên lớp <span aria-hidden="true">*</span>
            </label>
            <input
              id="classroom-name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              required
              minLength={2}
              maxLength={120}
              autoComplete="off"
              disabled={isSubmitting}
              aria-invalid={Boolean(error && name.trim().length < 2)}
              placeholder="Ví dụ: Toán 10A1"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="classroom-subject"
              className="mb-2 block font-extrabold"
            >
              Môn học{" "}
              <span className="font-semibold text-muted-foreground">
                (tùy chọn)
              </span>
            </label>
            <div className="relative">
              <BookOpen
                className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="classroom-subject"
                name="subject"
                type="text"
                value={subject}
                onChange={(event) => onSubjectChange(event.target.value)}
                maxLength={120}
                autoComplete="off"
                disabled={isSubmitting}
                placeholder="Toán học"
                className={`${INPUT_CLASS} pl-12`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="classroom-grade"
              className="mb-2 block font-extrabold"
            >
              Khối / lớp{" "}
              <span className="font-semibold text-muted-foreground">
                (tùy chọn)
              </span>
            </label>
            <div className="relative">
              <GraduationCap
                className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="classroom-grade"
                name="grade"
                type="text"
                value={grade}
                onChange={(event) => onGradeChange(event.target.value)}
                maxLength={50}
                autoComplete="off"
                disabled={isSubmitting}
                placeholder="Khối 10"
                className={`${INPUT_CLASS} pl-12`}
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="classroom-description"
              className="mb-2 block font-extrabold"
            >
              Mô tả{" "}
              <span className="font-semibold text-muted-foreground">
                (tùy chọn)
              </span>
            </label>
            <textarea
              id="classroom-description"
              name="description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              maxLength={2000}
              rows={4}
              disabled={isSubmitting}
              placeholder="Mục tiêu, nội dung hoặc ghi chú ngắn về lớp học..."
              className={`${INPUT_CLASS} resize-y`}
            />
            <p className="mt-1 text-right text-sm font-semibold text-muted-foreground">
              {description.length}/2000
            </p>
          </div>
        </div>

        {error ? (
          <p
            className="mt-5 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 font-bold"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/teacher/classes" className={SECONDARY_ACTION_CLASS}>
            Hủy
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className={PRIMARY_ACTION_CLASS}
          >
            {isSubmitting ? (
              <InlineSpinner label="Đang tạo lớp" />
            ) : (
              <>
                Tạo lớp và tiếp tục
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

function InvitationStep({
  classroom,
  emailInput,
  error,
  isSubmitting,
  onEmailInputChange,
  onSubmit,
  onSkip,
}: {
  classroom: ClassroomDetail;
  emailInput: string;
  error: string | null;
  isSubmitting: boolean;
  onEmailInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSkip: () => void;
}) {
  const parsed = parseEmailBatch(emailInput);

  return (
    <section
      className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-lg sm:p-8"
      aria-labelledby="invite-students-heading"
    >
      <div className="mb-7 flex items-start gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-success shadow-brutal-md">
          <MailPlus className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-extrabold text-secondary-strong">
            Bước 2 / 3
          </p>
          <h2
            id="invite-students-heading"
            className="font-display text-2xl font-extrabold"
          >
            Mời sinh viên vào {classroom.name}
          </h2>
          <p className="mt-1 font-semibold text-muted-foreground">
            Tài khoản đã có sẽ được thêm vào lớp; email chưa đăng ký sẽ nhận lời
            mời. Bạn cũng có thể bỏ qua bước này.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
        <EmailBatchInput
          value={emailInput}
          onChange={onEmailInputChange}
          disabled={isSubmitting}
          id="new-classroom-emails"
        />

        {error ? (
          <p
            className="mt-5 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 font-bold"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-muted-foreground">
            Lớp đã được lưu. Bạn có thể mời thêm sinh viên ở trang quản lý lớp.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onSkip}
              disabled={isSubmitting}
              className={SECONDARY_ACTION_CLASS}
            >
              Bỏ qua
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                parsed.invalidEmails.length > 0 ||
                parsed.emails.length > 100
              }
              className={PRIMARY_ACTION_CLASS}
            >
              {isSubmitting ? (
                <InlineSpinner label="Đang gửi lời mời" />
              ) : (
                <>
                  {parsed.emails.length > 0
                    ? `Mời ${parsed.emails.length} sinh viên`
                    : "Tiếp tục"}
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function SharingStep({
  classroom,
  inviteResponse,
}: {
  classroom: ClassroomDetail;
  inviteResponse: InviteStudentsResponse | null;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border-2 border-foreground bg-success-soft p-5 shadow-brutal-lg sm:p-6">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-success shadow-brutal-md">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-secondary-strong">
              Bước 3 / 3
            </p>
            <h2 className="font-display text-2xl font-extrabold">
              Lớp {classroom.name} đã sẵn sàng
            </h2>
            <p className="mt-1 font-semibold text-muted-foreground">
              Chia sẻ một trong các cách bên dưới để sinh viên tham gia lớp.
            </p>
          </div>
        </div>
      </section>

      {inviteResponse && inviteResponse.results.length > 0 ? (
        <InvitationResultSummary results={inviteResponse.results} />
      ) : null}

      <ClassroomSharePanel
        classroomName={classroom.name}
        joinCode={classroom.joinCode}
        joinUrl={classroom.joinUrl}
      />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href="/teacher/classes" className={SECONDARY_ACTION_CLASS}>
          Xem tất cả lớp
        </Link>
        <Link
          href={`/teacher/classes/${classroom.id}`}
          className={PRIMARY_ACTION_CLASS}
        >
          Đi tới lớp học
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function InvitationResultSummary({
  results,
}: {
  results: ClassroomInviteResult[];
}) {
  return (
    <section
      className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md"
      aria-labelledby="invite-results-heading"
    >
      <h2
        id="invite-results-heading"
        className="flex items-center gap-2 font-display text-xl font-extrabold"
      >
        <MailPlus className="h-5 w-5" aria-hidden="true" />
        Kết quả mời sinh viên
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {results.map((result) => (
          <li
            key={result.email}
            className="flex min-w-0 items-center gap-3 rounded-xl border-2 border-foreground bg-surface-soft px-4 py-3"
          >
            {result.status === "added" || result.status === "invited" ? (
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-foreground"
                aria-hidden="true"
              />
            ) : (
              <Circle className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate font-bold">
              {result.email}
            </span>
            <span className="shrink-0 rounded-full border-2 border-foreground bg-success-soft px-2 py-1 text-xs font-extrabold">
              {inviteResultLabel(result.status)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function inviteResultLabel(status: ClassroomInviteResult["status"]) {
  const labels: Record<ClassroomInviteResult["status"], string> = {
    added: "Đã thêm",
    invited: "Đã gửi lời mời",
    already_member: "Đã trong lớp",
    already_invited: "Đã được mời",
  };
  return labels[status];
}

function inviteSuccessMessage(response: InviteStudentsResponse) {
  const added = response.results.filter(
    (item) => item.status === "added",
  ).length;
  const invited = response.results.filter(
    (item) => item.status === "invited",
  ).length;
  if (added > 0 && invited > 0) {
    return `Đã thêm ${added} và gửi lời mời tới ${invited} sinh viên`;
  }
  if (added > 0) return `Đã thêm ${added} sinh viên vào lớp`;
  if (invited > 0) return `Đã gửi lời mời tới ${invited} sinh viên`;
  return "Danh sách sinh viên đã được xử lý";
}
