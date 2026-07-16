"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  CalendarDays,
  Eye,
  ExternalLink,
  FileText,
  GraduationCap,
  LibraryBig,
  RefreshCw,
  UserRound,
  Users,
} from "lucide-react";
import type { ClassroomDetail } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { publicQuizRoute } from "@/config/routes";
import { getClassroom } from "./classroom-api";
import {
  ClassroomErrorState,
  ClassroomLoadingState,
  SECONDARY_ACTION_CLASS,
} from "./classroom-ui";
import {
  StudentClassroomFrame,
  StudentClassroomPageHeader,
} from "./student-classroom-frame";
import {
  formatDate,
  getErrorMessage,
  isGoogleDriveUrl,
} from "./classroom-utils";
import { MaterialPreviewDialog } from "./material-preview-dialog";
import { MaterialDescription } from "./material-description";

type ClassroomTab = "overview" | "materials" | "quizzes";

export function StudentClassroomDetail({
  classroomId,
}: {
  classroomId: string;
}) {
  const { accessToken } = useAuth();
  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClassroomTab>("overview");
  const [previewing, setPreviewing] = useState<
    ClassroomDetail["materials"][number] | null
  >(null);

  const loadClassroom = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setClassroom(await getClassroom(classroomId, accessToken ?? undefined));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, classroomId]);

  useEffect(() => {
    let cancelled = false;

    getClassroom(classroomId, accessToken ?? undefined)
      .then((response) => {
        if (cancelled) return;
        setClassroom(response);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, classroomId]);

  return (
    <StudentClassroomFrame>
      {isLoading ? (
        <ClassroomLoadingState label="Đang tải nội dung lớp..." />
      ) : error || !classroom ? (
        <ClassroomErrorState
          message={error ?? "Không tìm thấy lớp học"}
          onRetry={() => void loadClassroom()}
        />
      ) : (
        <>
          <StudentClassroomPageHeader
            title={classroom.name}
            description={
              classroom.description || "Không gian học tập và nội dung của lớp."
            }
            backHref="/student/classes"
            backLabel="Về danh sách lớp"
          />

          <ClassroomTabs
            activeTab={activeTab}
            materialCount={classroom.materials.length}
            quizCount={classroom.quizzes.length}
            onChange={setActiveTab}
          />

          {activeTab === "overview" ? (
            <div
              id="classroom-panel-overview"
              role="tabpanel"
              aria-labelledby="classroom-tab-overview"
              className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
            >
              <section className="rounded-2xl border border-divider bg-surface p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="editorial-label">Thông tin lớp</p>
                    <h2 className="mt-3 font-display text-2xl font-bold">
                      Tổng quan
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadClassroom()}
                    className={SECONDARY_ACTION_CLASS}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> Làm mới
                  </button>
                </div>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Info
                    icon={LibraryBig}
                    label="Môn học"
                    value={classroom.subject || "Chưa cập nhật"}
                  />
                  <Info
                    icon={GraduationCap}
                    label="Khối lớp"
                    value={classroom.grade || "Chưa cập nhật"}
                  />
                  <Info
                    icon={Users}
                    label="Thành viên"
                    value={`${classroom.memberCount} học sinh`}
                  />
                  <Info
                    icon={CalendarDays}
                    label="Ngày tạo"
                    value={formatDate(classroom.createdAt)}
                  />
                </dl>
              </section>

              <aside className="rounded-2xl border border-divider bg-surface-soft p-5 sm:p-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-soft text-secondary">
                  <UserRound className="h-7 w-7" aria-hidden="true" />
                </span>
                <p className="editorial-label mt-5">Giáo viên phụ trách</p>
                <h2 className="mt-3 break-words font-display text-2xl font-bold">
                  {classroom.teacher.fullName}
                </h2>
                <p className="mt-2 font-semibold text-muted-foreground">
                  Người quản lý và đăng nội dung học tập cho lớp này.
                </p>
              </aside>
            </div>
          ) : null}

          {activeTab === "materials" ? (
            <div
              id="classroom-panel-materials"
              role="tabpanel"
              aria-labelledby="classroom-tab-materials"
            >
              <ContentSection
                title="Tài liệu học tập"
                description="Bài đọc, tệp và liên kết giáo viên chia sẻ."
                icon={FileText}
                emptyTitle="Chưa có tài liệu"
                emptyDescription="Tài liệu giáo viên đăng sẽ xuất hiện tại đây."
                count={classroom.materials.length}
              >
                {classroom.materials.map((material) => (
                  <article
                    key={material.id}
                    className="rounded-xl border border-divider bg-surface-soft p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-extrabold">
                            {material.title}
                          </h3>
                          {material.type === "link" &&
                          isGoogleDriveUrl(material.url) ? (
                            <span className="rounded-full border border-foreground bg-secondary-soft px-2 py-0.5 text-xs font-extrabold">
                              Google Drive
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">
                          {material.type === "file"
                            ? material.originalName || "Tệp tài liệu"
                            : isGoogleDriveUrl(material.url)
                              ? "Bản gốc được lưu trên Google Drive"
                              : "Liên kết ngoài"}
                        </p>
                        {material.description ? (
                          <MaterialDescription text={material.description} />
                        ) : null}
                      </div>
                      {material.type === "link" && material.url ? (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${SECONDARY_ACTION_CLASS} shrink-0`}
                        >
                          <ExternalLink
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          {isGoogleDriveUrl(material.url)
                            ? "Mở trên Google Drive"
                            : "Mở liên kết"}
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPreviewing(material)}
                          className={`${SECONDARY_ACTION_CLASS} shrink-0`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Xem tài liệu
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </ContentSection>
            </div>
          ) : null}

          {activeTab === "quizzes" ? (
            <div
              id="classroom-panel-quizzes"
              role="tabpanel"
              aria-labelledby="classroom-tab-quizzes"
            >
              <ContentSection
                title="Hoạt động của lớp"
                description="Nội dung luyện tập và kiểm tra dành cho lớp."
                icon={BookOpenCheck}
                emptyTitle="Chưa có hoạt động"
                emptyDescription="Nội dung giáo viên giao sẽ xuất hiện tại đây."
                count={classroom.quizzes.length}
              >
                {classroom.quizzes.map((quiz) => (
                  <Link
                    key={quiz.id}
                    href={publicQuizRoute(quiz.id)}
                    className="block cursor-pointer rounded-xl border border-divider bg-surface-soft p-4 transition-colors hover:border-foreground/40 hover:bg-secondary-soft"
                  >
                    <h3 className="font-extrabold">{quiz.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">
                      {quiz.questionCount} câu hỏi
                      {quiz.dueAt ? ` · Hạn ${formatDate(quiz.dueAt)}` : ""}
                    </p>
                  </Link>
                ))}
              </ContentSection>
            </div>
          ) : null}
          {previewing ? (
            <MaterialPreviewDialog
              classroomId={classroomId}
              material={previewing}
              accessToken={accessToken ?? undefined}
              onClose={() => setPreviewing(null)}
            />
          ) : null}
        </>
      )}
    </StudentClassroomFrame>
  );
}

function ClassroomTabs({
  activeTab,
  materialCount,
  quizCount,
  onChange,
}: {
  activeTab: ClassroomTab;
  materialCount: number;
  quizCount: number;
  onChange: (tab: ClassroomTab) => void;
}) {
  const tabs: Array<{
    id: ClassroomTab;
    label: string;
    icon: typeof Users;
    count?: number;
  }> = [
    { id: "overview", label: "Tổng quan", icon: LibraryBig },
    {
      id: "materials",
      label: "Tài liệu",
      icon: FileText,
      count: materialCount,
    },
    {
      id: "quizzes",
      label: "Hoạt động",
      icon: BookOpenCheck,
      count: quizCount,
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
    document.getElementById(`classroom-tab-${tabs[nextIndex].id}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Nội dung lớp học"
      className="mb-6 flex gap-1 overflow-x-auto border-b border-divider"
    >
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`classroom-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`classroom-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-4 py-2 text-sm font-bold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
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

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-divider bg-surface-soft p-4">
      <dt className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 break-words font-extrabold">{value}</dd>
    </div>
  );
}

function ContentSection({
  title,
  description,
  icon: Icon,
  emptyTitle,
  emptyDescription,
  count,
  children,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
  emptyTitle: string;
  emptyDescription: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-divider bg-surface p-5 sm:p-6"
      aria-labelledby={`${title}-title`}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id={`${title}-title`}
              className="font-display text-xl font-bold"
            >
              {title}
            </h2>
            <span className="rounded-full border border-divider bg-surface-soft px-3 py-1 text-xs font-bold">
              {count} mục
            </span>
          </div>
          <p className="mt-1 font-semibold text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {count > 0 ? (
        <div className="mt-6 space-y-3">{children}</div>
      ) : (
        <div className="mt-6 rounded-xl border-2 border-dashed border-divider bg-background p-7 text-center">
          <Icon
            className="mx-auto h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          />
          <h3 className="mt-3 font-display text-lg font-extrabold">
            {emptyTitle}
          </h3>
          <p className="mt-1 font-semibold text-muted-foreground">
            {emptyDescription}
          </p>
        </div>
      )}
    </section>
  );
}
