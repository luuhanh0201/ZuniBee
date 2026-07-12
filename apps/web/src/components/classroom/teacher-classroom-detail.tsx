"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  MailPlus,
  RefreshCw,
  RotateCw,
  Send,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import type {
  ClassroomDetail,
  ClassroomInvitation,
  ClassroomMember,
  InviteStudentsResponse,
} from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast-provider";
import {
  getClassroom,
  inviteStudents,
  regenerateClassroomAccess,
  resendClassroomInvitation,
  revokeClassroomInvitation,
} from "./classroom-api";
import { ClassroomSharePanel } from "./classroom-share-panel";
import {
  ClassroomErrorState,
  ClassroomLoadingState,
  ClassroomPageHeader,
  DANGER_ACTION_CLASS,
  InlineSpinner,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
  TeacherClassroomFrame,
} from "./classroom-ui";
import { EmailBatchInput } from "./email-batch-input";
import { TeacherMaterialsManager } from "./teacher-materials-manager";
import {
  formatDate,
  formatDateTime,
  getErrorMessage,
  parseEmailBatch,
} from "./classroom-utils";

type TeacherClassroomTab =
  "overview" | "members" | "invitations" | "materials" | "quizzes";

export function TeacherClassroomDetail({
  classroomId,
}: {
  classroomId: string;
}) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TeacherClassroomTab>("overview");
  const inviteLockRef = useRef(false);
  const actionLockRef = useRef(false);

  const loadClassroom = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoading(true);
        setLoadError(null);
      }
      try {
        const response = await getClassroom(
          classroomId,
          accessToken ?? undefined,
        );
        setClassroom(response);
      } catch (requestError) {
        if (!silent) setLoadError(getErrorMessage(requestError));
        throw requestError;
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [accessToken, classroomId],
  );

  useEffect(() => {
    let cancelled = false;
    getClassroom(classroomId, accessToken ?? undefined)
      .then((response) => {
        if (cancelled) return;
        setClassroom(response);
        setLoadError(null);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setLoadError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, classroomId]);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviteLockRef.current || !classroom) return;

    const parsed = parseEmailBatch(emailInput);
    if (parsed.invalidEmails.length > 0) {
      setInviteError("Vui lòng sửa các email sai định dạng trước khi gửi");
      return;
    }
    if (parsed.emails.length > 100) {
      setInviteError("Mỗi lần chỉ được mời tối đa 100 email");
      return;
    }
    if (parsed.emails.length === 0) {
      setInviteError("Vui lòng nhập ít nhất một email sinh viên");
      return;
    }

    inviteLockRef.current = true;
    setIsInviting(true);
    setInviteError(null);
    try {
      const response = await inviteStudents(
        classroom.id,
        { emails: parsed.emails },
        accessToken ?? undefined,
      );
      setEmailInput("");
      await loadClassroom(true);
      showToast("success", invitationResultMessage(response));
    } catch (requestError) {
      setInviteError(getErrorMessage(requestError));
    } finally {
      inviteLockRef.current = false;
      setIsInviting(false);
    }
  }

  async function handleResend(invitation: ClassroomInvitation) {
    if (!classroom || actionLockRef.current) return;
    actionLockRef.current = true;
    setActiveAction(`resend:${invitation.id}`);
    setMutationError(null);
    try {
      await resendClassroomInvitation(
        classroom.id,
        invitation.id,
        accessToken ?? undefined,
      );
      await loadClassroom(true);
      showToast("success", `Đã gửi lại lời mời tới ${invitation.email}`);
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setMutationError(message);
      showToast("error", message);
    } finally {
      actionLockRef.current = false;
      setActiveAction(null);
    }
  }

  async function handleRevoke(invitation: ClassroomInvitation) {
    if (!classroom || actionLockRef.current) return;
    const confirmed = window.confirm(
      `Thu hồi lời mời của ${invitation.email}? Link trong email đó sẽ không còn sử dụng được.`,
    );
    if (!confirmed) return;

    actionLockRef.current = true;
    setActiveAction(`revoke:${invitation.id}`);
    setMutationError(null);
    try {
      await revokeClassroomInvitation(
        classroom.id,
        invitation.id,
        accessToken ?? undefined,
      );
      await loadClassroom(true);
      showToast("success", `Đã thu hồi lời mời của ${invitation.email}`);
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setMutationError(message);
      showToast("error", message);
    } finally {
      actionLockRef.current = false;
      setActiveAction(null);
    }
  }

  async function handleRegenerateAccess() {
    if (!classroom || actionLockRef.current) return;
    actionLockRef.current = true;
    setActiveAction("regenerate");
    setMutationError(null);
    try {
      const access = await regenerateClassroomAccess(
        classroom.id,
        accessToken ?? undefined,
      );
      setClassroom((current) =>
        current
          ? { ...current, joinCode: access.joinCode, joinUrl: access.joinUrl }
          : current,
      );
      showToast("success", "Đã tạo mã và link tham gia mới");
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setMutationError(message);
      showToast("error", message);
    } finally {
      actionLockRef.current = false;
      setActiveAction(null);
    }
  }

  return (
    <TeacherClassroomFrame>
      {isLoading ? (
        <ClassroomLoadingState label="Đang tải thông tin lớp..." />
      ) : loadError || !classroom ? (
        <ClassroomErrorState
          message={loadError ?? "Không tìm thấy lớp học"}
          onRetry={() => void loadClassroom().catch(() => undefined)}
        />
      ) : (
        <>
          <ClassroomPageHeader
            title={classroom.name}
            description={
              classroom.description ||
              "Quản lý thành viên, lời mời và các cách tham gia lớp học."
            }
            backHref="/teacher/classes"
            backLabel="Về danh sách lớp"
            actions={
              <button
                type="button"
                onClick={() => void loadClassroom().catch(() => undefined)}
                className={SECONDARY_ACTION_CLASS}
              >
                <RefreshCw className="h-5 w-5" aria-hidden="true" />
                Làm mới
              </button>
            }
          />

          <TeacherClassroomTabs
            activeTab={activeTab}
            classroom={classroom}
            onChange={setActiveTab}
          />

          {mutationError ? (
            <p
              className="mt-6 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 font-bold"
              role="alert"
            >
              {mutationError}
            </p>
          ) : null}

          {activeTab === "overview" ? (
            <div
              id="teacher-classroom-panel-overview"
              role="tabpanel"
              aria-labelledby="teacher-classroom-tab-overview"
            >
              <ClassroomOverview classroom={classroom} />
              <div className="mt-6">
                <ClassroomSharePanel
                  classroomName={classroom.name}
                  joinCode={classroom.joinCode}
                  joinUrl={classroom.joinUrl}
                  onRegenerate={handleRegenerateAccess}
                  isRegenerating={activeAction === "regenerate"}
                />
              </div>
            </div>
          ) : null}

          {activeTab === "members" ? (
            <div
              id="teacher-classroom-panel-members"
              role="tabpanel"
              aria-labelledby="teacher-classroom-tab-members"
            >
              <MembersSection members={classroom.members} />
            </div>
          ) : null}

          {activeTab === "invitations" ? (
            <section
              id="teacher-classroom-panel-invitations"
              role="tabpanel"
              aria-labelledby="teacher-classroom-tab-invitations"
              className="grid items-start gap-6 xl:grid-cols-2"
            >
              <InviteStudentsCard
                value={emailInput}
                error={inviteError}
                isSubmitting={isInviting}
                onChange={(value) => {
                  setEmailInput(value);
                  if (inviteError) setInviteError(null);
                }}
                onSubmit={handleInvite}
              />
              <InvitationsSection
                invitations={classroom.invitations}
                activeAction={activeAction}
                onResend={handleResend}
                onRevoke={handleRevoke}
              />
            </section>
          ) : null}

          {activeTab === "materials" ? (
            <TeacherMaterialsManager
              classroomId={classroom.id}
              materials={classroom.materials}
              accessToken={accessToken ?? undefined}
              onChanged={() => loadClassroom(true)}
            />
          ) : null}

          {activeTab === "quizzes" ? (
            <TeacherEmptyContent
              id="teacher-classroom-panel-quizzes"
              labelledBy="teacher-classroom-tab-quizzes"
              icon={BookOpen}
              title="Quiz của lớp"
              description="Tính năng tạo và giao quiz cho lớp sẽ được bổ sung tại đây."
            />
          ) : null}
        </>
      )}
    </TeacherClassroomFrame>
  );
}

function TeacherClassroomTabs({
  activeTab,
  classroom,
  onChange,
}: {
  activeTab: TeacherClassroomTab;
  classroom: ClassroomDetail;
  onChange: (tab: TeacherClassroomTab) => void;
}) {
  const tabs: Array<{
    id: TeacherClassroomTab;
    label: string;
    icon: typeof BookOpen;
    count?: number;
  }> = [
    { id: "overview", label: "Tổng quan", icon: BookOpen },
    {
      id: "members",
      label: "Thành viên",
      icon: Users,
      count: classroom.memberCount,
    },
    {
      id: "invitations",
      label: "Lời mời",
      icon: Mail,
      count: classroom.pendingInvitationCount,
    },
    {
      id: "materials",
      label: "Tài liệu",
      icon: FileText,
      count: classroom.materials.length,
    },
    {
      id: "quizzes",
      label: "Quiz",
      icon: BookOpen,
      count: classroom.quizzes.length,
    },
  ];

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
    onChange(tabs[nextIndex].id);
    document
      .getElementById(`teacher-classroom-tab-${tabs[nextIndex].id}`)
      ?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Quản lý lớp học"
      className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border-2 border-foreground bg-surface p-2 shadow-brutal-sm"
    >
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`teacher-classroom-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`teacher-classroom-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${isActive ? "border-foreground bg-primary shadow-brutal-xs" : "border-transparent text-muted-foreground hover:bg-surface-soft hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {tab.label}
            {tab.count !== undefined ? (
              <span className="rounded-full border border-current px-2 py-0.5 text-xs tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function TeacherEmptyContent({
  id,
  labelledBy,
  icon: Icon,
  title,
  description,
}: {
  id: string;
  labelledBy: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
}) {
  return (
    <section
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className="rounded-2xl border-2 border-foreground bg-surface p-8 text-center shadow-brutal-md sm:p-12"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-foreground bg-primary shadow-brutal-sm">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg font-semibold text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

function ClassroomOverview({ classroom }: { classroom: ClassroomDetail }) {
  const details = [classroom.subject, classroom.grade].filter(Boolean);
  return (
    <section
      className="grid gap-4 rounded-2xl border-2 border-foreground bg-secondary-soft p-5 shadow-brutal-md sm:grid-cols-2 lg:grid-cols-4 sm:p-6"
      aria-label="Tổng quan lớp học"
    >
      <OverviewItem
        icon={BookOpen}
        label="Môn / khối"
        value={details.join(" · ") || "Chưa cập nhật"}
        accent="bg-secondary"
      />
      <OverviewItem
        icon={Users}
        label="Sinh viên"
        value={`${classroom.memberCount}`}
        accent="bg-success"
      />
      <OverviewItem
        icon={Clock3}
        label="Lời mời đang chờ"
        value={`${classroom.pendingInvitationCount}`}
        accent="bg-primary"
      />
      <OverviewItem
        icon={CalendarDays}
        label="Ngày tạo"
        value={formatDate(classroom.createdAt)}
        accent="bg-surface"
      />
    </section>
  );
}

function OverviewItem({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border-2 border-foreground bg-surface p-3">
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-foreground ${accent}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate font-extrabold">{value}</p>
      </div>
    </div>
  );
}

function MembersSection({ members }: { members: ClassroomMember[] }) {
  return (
    <section
      className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md sm:p-6"
      aria-labelledby="classroom-members-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-secondary-strong">
            Thành viên
          </p>
          <h2
            id="classroom-members-heading"
            className="font-display text-2xl font-extrabold"
          >
            Sinh viên trong lớp
          </h2>
        </div>
        <span className="rounded-full border-2 border-foreground bg-success-soft px-3 py-1 text-sm font-extrabold">
          {members.length} sinh viên
        </span>
      </div>

      {members.length === 0 ? (
        <div className="mt-5 flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-soft p-6 text-center">
          <Users
            className="h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h3 className="mt-3 font-display text-lg font-extrabold">
            Chưa có sinh viên
          </h3>
          <p className="mt-1 max-w-sm font-semibold text-muted-foreground">
            Mời qua email hoặc chia sẻ mã, link, QR để sinh viên tham gia.
          </p>
        </div>
      ) : (
        <ul className="mt-5 divide-y-2 divide-divider">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberRow({ member }: { member: ClassroomMember }) {
  return (
    <li className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-secondary-soft shadow-brutal-xs">
        <UserRound className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">{member.fullName}</p>
        <p className="truncate text-sm font-semibold text-muted-foreground">
          {member.email || "Chưa có email"}
        </p>
      </div>
      <p className="hidden shrink-0 text-right text-xs font-bold text-muted-foreground sm:block">
        Tham gia
        <br />
        {formatDate(member.joinedAt)}
      </p>
    </li>
  );
}

function InviteStudentsCard({
  value,
  error,
  isSubmitting,
  onChange,
  onSubmit,
}: {
  value: string;
  error: string | null;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const parsed = parseEmailBatch(value);
  return (
    <section
      className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md sm:p-6"
      aria-labelledby="add-students-heading"
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-primary shadow-brutal-sm">
          <MailPlus className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-extrabold text-secondary-strong">
            Thêm nhanh
          </p>
          <h2
            id="add-students-heading"
            className="font-display text-xl font-extrabold"
          >
            Mời bằng email
          </h2>
        </div>
      </div>
      <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
        <EmailBatchInput
          value={value}
          onChange={onChange}
          disabled={isSubmitting}
          id="manage-classroom-emails"
        />
        {error ? (
          <p
            className="mt-4 rounded-xl border-2 border-foreground bg-destructive-soft px-4 py-3 font-bold"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={
            isSubmitting ||
            parsed.emails.length === 0 ||
            parsed.invalidEmails.length > 0 ||
            parsed.emails.length > 100
          }
          className={`${PRIMARY_ACTION_CLASS} mt-5 w-full`}
        >
          {isSubmitting ? (
            <InlineSpinner label="Đang gửi lời mời" />
          ) : (
            <>
              <Send className="h-5 w-5" aria-hidden="true" />
              {parsed.emails.length > 0
                ? `Mời ${parsed.emails.length} sinh viên`
                : "Gửi lời mời"}
            </>
          )}
        </button>
      </form>
    </section>
  );
}

function InvitationsSection({
  invitations,
  activeAction,
  onResend,
  onRevoke,
}: {
  invitations: ClassroomInvitation[];
  activeAction: string | null;
  onResend: (invitation: ClassroomInvitation) => void;
  onRevoke: (invitation: ClassroomInvitation) => void;
}) {
  return (
    <section
      className="rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md sm:p-6"
      aria-labelledby="classroom-invitations-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-secondary-strong">
            Theo dõi
          </p>
          <h2
            id="classroom-invitations-heading"
            className="font-display text-xl font-extrabold"
          >
            Lời mời qua email
          </h2>
        </div>
        <span className="rounded-full border-2 border-foreground bg-warning-soft px-3 py-1 text-sm font-extrabold">
          {invitations.filter((item) => item.status === "pending").length} đang
          chờ
        </span>
      </div>

      {invitations.length === 0 ? (
        <div className="mt-5 rounded-xl border-2 border-dashed border-border bg-surface-soft p-5 text-center">
          <Mail
            className="mx-auto h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="mt-2 font-bold text-muted-foreground">
            Chưa có lời mời qua email.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {invitations.map((invitation) => {
            const resendAction = activeAction === `resend:${invitation.id}`;
            const revokeAction = activeAction === `revoke:${invitation.id}`;
            const isPending = invitation.status === "pending";
            const canResend = isPending || invitation.status === "expired";
            return (
              <li
                key={invitation.id}
                className="rounded-xl border-2 border-foreground bg-surface-soft p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-all font-extrabold">
                      {invitation.email}
                    </p>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">
                      {isPending
                        ? `Hết hạn ${formatDateTime(invitation.expiresAt)}`
                        : `Tạo lúc ${formatDateTime(invitation.createdAt)}`}
                    </p>
                  </div>
                  <InvitationStatusBadge status={invitation.status} />
                </div>

                {canResend ? (
                  <div className="mt-3 flex flex-col gap-2 border-t-2 border-divider pt-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => onResend(invitation)}
                      disabled={activeAction !== null}
                      className={`${SECONDARY_ACTION_CLASS} min-h-10 flex-1 px-3 py-2 text-sm`}
                    >
                      {resendAction ? (
                        <InlineSpinner label="Đang gửi" />
                      ) : (
                        <>
                          <RotateCw className="h-4 w-4" aria-hidden="true" />
                          Gửi lại
                        </>
                      )}
                    </button>
                    {isPending ? (
                      <button
                        type="button"
                        onClick={() => onRevoke(invitation)}
                        disabled={activeAction !== null}
                        className={`${DANGER_ACTION_CLASS} min-h-10 flex-1 px-3 py-2 text-sm`}
                      >
                        {revokeAction ? (
                          <InlineSpinner label="Đang thu hồi" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Thu hồi
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function InvitationStatusBadge({
  status,
}: {
  status: ClassroomInvitation["status"];
}) {
  const config: Record<
    ClassroomInvitation["status"],
    { label: string; className: string }
  > = {
    pending: { label: "Đang chờ", className: "bg-warning-soft" },
    accepted: { label: "Đã tham gia", className: "bg-success-soft" },
    revoked: { label: "Đã thu hồi", className: "bg-destructive-soft" },
    expired: { label: "Đã hết hạn", className: "bg-surface" },
  };
  const current = config[status];
  return (
    <span
      className={`shrink-0 rounded-full border-2 border-foreground px-2 py-1 text-xs font-extrabold ${current.className}`}
    >
      {status === "accepted" ? (
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
      ) : null}
      {current.label}
    </span>
  );
}

function invitationResultMessage(response: InviteStudentsResponse) {
  const newActions = response.results.filter(
    (result) => result.status === "added" || result.status === "invited",
  ).length;
  const existing = response.results.length - newActions;
  if (newActions > 0 && existing > 0) {
    return `Đã xử lý ${newActions} email mới; ${existing} email đã có trong lớp hoặc đã được mời`;
  }
  if (newActions > 0) return `Đã xử lý ${newActions} email sinh viên`;
  return "Các sinh viên này đã ở trong lớp hoặc đã được mời";
}
