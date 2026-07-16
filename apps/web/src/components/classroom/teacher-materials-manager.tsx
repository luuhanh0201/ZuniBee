"use client";

import { useRef, useState } from "react";
import {
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ClassroomMaterial } from "@zunibee/shared";
import { useToast } from "@/components/ui/toast-provider";
import {
  createClassroomMaterialLink,
  deleteClassroomMaterial,
  updateClassroomMaterial,
  uploadClassroomMaterialFiles,
} from "./classroom-api";
import {
  DANGER_ACTION_CLASS,
  InlineSpinner,
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "./classroom-ui";
import {
  formatDate,
  getErrorMessage,
  isGoogleDriveUrl,
} from "./classroom-utils";
import { MaterialPreviewDialog } from "./material-preview-dialog";
import { MaterialDescription } from "./material-description";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;
type MaterialSource = "upload" | "drive";

export function TeacherMaterialsManager({
  classroomId,
  materials,
  accessToken,
  onChanged,
}: {
  classroomId: string;
  materials: ClassroomMaterial[];
  accessToken?: string;
  onChanged: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [source, setSource] = useState<MaterialSource>("upload");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClassroomMaterial | null>(null);
  const [previewing, setPreviewing] = useState<ClassroomMaterial | null>(null);
  const actionLockRef = useRef(false);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (actionLockRef.current) return;
    if (source === "upload") {
      if (files.length === 0) return setError("Vui lòng chọn ít nhất một tệp");
      if (files.length > MAX_FILES)
        return setError(`Mỗi lần chỉ được tải tối đa ${MAX_FILES} tệp`);
      const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
      if (oversized)
        return setError(`Tệp ${oversized.name} vượt quá giới hạn 50 MB`);
    } else {
      if (!linkTitle.trim()) return setError("Vui lòng nhập tên tài liệu");
      if (!driveUrl.trim())
        return setError("Vui lòng nhập liên kết Google Drive");
    }

    actionLockRef.current = true;
    setActiveAction("create");
    setError(null);
    try {
      if (source === "upload") {
        await uploadClassroomMaterialFiles(
          classroomId,
          { description: description.trim() || undefined, files },
          accessToken,
        );
      } else {
        await createClassroomMaterialLink(
          classroomId,
          {
            title: linkTitle.trim(),
            description: description.trim() || undefined,
            url: driveUrl.trim(),
          },
          accessToken,
        );
      }
      setDescription("");
      if (source === "upload") {
        setFiles([]);
        form.reset();
      } else {
        setLinkTitle("");
        setDriveUrl("");
      }
      await onChanged();
      showToast(
        "success",
        source === "upload"
          ? `Đã tải lên ${files.length} tài liệu`
          : "Đã thêm liên kết Google Drive",
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      actionLockRef.current = false;
      setActiveAction(null);
    }
  }

  async function handleDelete(material: ClassroomMaterial) {
    if (
      actionLockRef.current ||
      !window.confirm(`Xóa tài liệu “${material.title}”?`)
    )
      return;
    actionLockRef.current = true;
    setActiveAction(`delete:${material.id}`);
    try {
      await deleteClassroomMaterial(classroomId, material.id, accessToken);
      await onChanged();
      showToast("success", "Đã xóa tài liệu");
    } catch (requestError) {
      showToast("error", getErrorMessage(requestError));
    } finally {
      actionLockRef.current = false;
      setActiveAction(null);
    }
  }

  return (
    <div
      id="teacher-classroom-panel-materials"
      role="tabpanel"
      aria-labelledby="teacher-classroom-tab-materials"
      className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]"
    >
      <section className="rounded-2xl border border-divider bg-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="editorial-label">Thêm nội dung</p>
            <h2 className="mt-2 font-display text-xl font-bold">
              Tài liệu mới
            </h2>
          </div>
        </div>

        <form
          onSubmit={handleCreate}
          className="mt-5 space-y-4"
          aria-busy={activeAction === "create"}
        >
          <div>
            <p className="mb-1.5 text-sm font-extrabold">Nguồn tài liệu</p>
            <div
              className="grid grid-cols-2 gap-2 rounded-xl border border-divider bg-surface-soft p-2"
              role="group"
              aria-label="Chọn nguồn tài liệu"
            >
              <SourceButton
                active={source === "upload"}
                disabled={activeAction !== null}
                icon={Upload}
                label="Upload file"
                onClick={() => {
                  setSource("upload");
                  setError(null);
                }}
              />
              <SourceButton
                active={source === "drive"}
                disabled={activeAction !== null}
                icon={Link2}
                label="Google Drive"
                onClick={() => {
                  setSource("drive");
                  setError(null);
                }}
              />
            </div>
          </div>

          {source === "upload" ? (
            <>
              <Field
                label="Tệp (tối đa 10 tệp, mỗi tệp 50 MB)"
                htmlFor="material-files"
              >
                <input
                  id="material-files"
                  type="file"
                  multiple
                  className={`${INPUT_CLASS} cursor-pointer py-2.5 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-foreground file:bg-primary file:px-3 file:py-1.5 file:font-bold`}
                  onChange={(event) => {
                    setFiles(Array.from(event.target.files ?? []));
                    setError(null);
                  }}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt,.zip"
                />
              </Field>
              {files.length > 0 ? (
                <ul className="space-y-2" aria-label="Các tệp đã chọn">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${file.lastModified}`}
                      className="flex items-center gap-3 rounded-xl border border-divider bg-surface-soft px-3 py-2"
                    >
                      <FileText
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {file.name}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((current) =>
                            current.filter(
                              (_, fileIndex) => fileIndex !== index,
                            ),
                          )
                        }
                        aria-label={`Bỏ chọn ${file.name}`}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-destructive-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <>
              <Field label="Tên tài liệu" htmlFor="material-link-title">
                <input
                  id="material-link-title"
                  className={INPUT_CLASS}
                  value={linkTitle}
                  onChange={(event) => {
                    setLinkTitle(event.target.value);
                    setError(null);
                  }}
                  maxLength={160}
                  required
                  placeholder="Ví dụ: Giáo trình tiếng Anh"
                />
              </Field>
              <Field label="Liên kết Google Drive" htmlFor="material-drive-url">
                <input
                  id="material-drive-url"
                  type="url"
                  className={INPUT_CLASS}
                  value={driveUrl}
                  onChange={(event) => {
                    setDriveUrl(event.target.value);
                    setError(null);
                  }}
                  maxLength={2048}
                  required
                  placeholder="https://drive.google.com/file/d/..."
                />
              </Field>
              <div className="flex gap-3 rounded-xl border border-divider bg-secondary-soft px-4 py-3 text-sm font-semibold">
                <ExternalLink
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>
                  Hãy đặt quyền <strong>Anyone with the link</strong> và vai trò{" "}
                  <strong>Viewer</strong>. ZuniBee chỉ lưu liên kết; quyền xem,
                  tải và in do Google Drive quản lý.
                </p>
              </div>
            </>
          )}

          <Field label="Mô tả (không bắt buộc)" htmlFor="material-description">
            <textarea
              id="material-description"
              className={`${INPUT_CLASS} min-h-24 resize-y`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              placeholder="Ghi chú thêm về tài liệu..."
            />
          </Field>
          {error ? (
            <p
              className="rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 font-bold"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={activeAction !== null}
            className={`${PRIMARY_ACTION_CLASS} w-full`}
          >
            {activeAction === "create" ? (
              <InlineSpinner label="Đang thêm" />
            ) : (
              <>
                {source === "upload" ? (
                  <Upload className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Link2 className="h-5 w-5" aria-hidden="true" />
                )}
                {source === "upload"
                  ? `Tải ${files.length || "các"} tài liệu lên`
                  : "Thêm liên kết Drive"}
              </>
            )}
          </button>
        </form>
      </section>

      <section
        className="rounded-2xl border border-divider bg-surface p-5 sm:p-6"
        aria-labelledby="teacher-material-list-title"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="editorial-label">Nội dung lớp</p>
            <h2
              id="teacher-material-list-title"
              className="mt-2 font-display text-2xl font-bold"
            >
              Danh sách tài liệu
            </h2>
          </div>
          <span className="rounded-full border border-divider bg-secondary-soft px-3 py-1 text-sm font-bold">
            {materials.length} mục
          </span>
        </div>
        {materials.length === 0 ? (
          <div className="mt-5 rounded-xl border-2 border-dashed border-divider bg-background p-8 text-center">
            <FileText
              className="mx-auto h-9 w-9 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="mt-3 font-display text-lg font-extrabold">
              Chưa có tài liệu
            </h3>
            <p className="mt-1 font-semibold text-muted-foreground">
              Tải tệp hoặc thêm liên kết Drive để chia sẻ với học sinh.
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {materials.map((material) => (
              <MaterialRow
                key={material.id}
                material={material}
                activeAction={activeAction}
                onEdit={() => setEditing(material)}
                onPreview={() => setPreviewing(material)}
                onDelete={() => void handleDelete(material)}
              />
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <EditMaterialDialog
          classroomId={classroomId}
          material={editing}
          accessToken={accessToken}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
            showToast("success", "Đã cập nhật tài liệu");
          }}
        />
      ) : null}
      {previewing ? (
        <MaterialPreviewDialog
          classroomId={classroomId}
          material={previewing}
          accessToken={accessToken}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-extrabold">
        {label}
      </label>
      {children}
    </div>
  );
}

function SourceButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? "border-foreground bg-primary shadow-brutal-sm"
          : "border-transparent bg-surface hover:border-foreground"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function MaterialRow({
  material,
  activeAction,
  onEdit,
  onPreview,
  onDelete,
}: {
  material: ClassroomMaterial;
  activeAction: string | null;
  onEdit: () => void;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const isLink = material.type === "link";
  const isDrive = isLink && isGoogleDriveUrl(material.url);
  return (
    <li className="rounded-xl border border-divider bg-surface-soft p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
          {isLink ? (
            <Link2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            <FileText className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-extrabold">{material.title}</h3>
            {isDrive ? (
              <span className="rounded-full border border-foreground bg-secondary-soft px-2 py-0.5 text-xs font-extrabold">
                Google Drive
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {material.type === "file"
              ? `${material.originalName || "Tệp tài liệu"}${material.size ? ` · ${formatFileSize(material.size)}` : ""}`
              : isDrive
                ? "Bản gốc được lưu trên Google Drive"
                : "Liên kết ngoài"}{" "}
            · {formatDate(material.createdAt)}
          </p>
          {material.description ? (
            <MaterialDescription text={material.description} />
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-divider pt-3">
        {isLink && material.url ? (
          <a
            href={material.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Mở ${material.title} trên ${isDrive ? "Google Drive" : "trang nguồn"}`}
            className={`${SECONDARY_ACTION_CLASS} min-h-10 px-2 py-2 text-sm`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {isDrive ? "Mở Drive" : "Mở link"}
          </a>
        ) : (
          <button
            type="button"
            onClick={onPreview}
            disabled={activeAction !== null}
            className={`${SECONDARY_ACTION_CLASS} min-h-10 px-2 py-2 text-sm`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Xem
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          disabled={activeAction !== null}
          className={`${SECONDARY_ACTION_CLASS} min-h-10 px-2 py-2 text-sm`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Sửa
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={activeAction !== null}
          className={`${DANGER_ACTION_CLASS} min-h-10 px-2 py-2 text-sm`}
        >
          {activeAction === `delete:${material.id}` ? (
            <InlineSpinner label="Xóa" />
          ) : (
            <>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Xóa
            </>
          )}
        </button>
      </div>
    </li>
  );
}

function EditMaterialDialog({
  classroomId,
  material,
  accessToken,
  onClose,
  onSaved,
}: {
  classroomId: string;
  material: ClassroomMaterial;
  accessToken?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(material.title);
  const [description, setDescription] = useState(material.description ?? "");
  const [url, setUrl] = useState(material.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateClassroomMaterial(
        classroomId,
        material.id,
        {
          title: title.trim(),
          description: description.trim(),
          ...(material.type === "link" ? { url: url.trim() } : {}),
        },
        accessToken,
      );
      await onSaved();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-material-title"
        className="w-full max-w-lg rounded-2xl border-2 border-foreground bg-surface p-6 shadow-brutal-xl"
      >
        <h2
          id="edit-material-title"
          className="font-display text-2xl font-extrabold"
        >
          Sửa tài liệu
        </h2>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Tên tài liệu" htmlFor="edit-material-name">
            <input
              id="edit-material-name"
              className={INPUT_CLASS}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="Mô tả" htmlFor="edit-material-description">
            <textarea
              id="edit-material-description"
              className={`${INPUT_CLASS} min-h-24 resize-y`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          {material.type === "link" ? (
            <Field label="Liên kết Google Drive" htmlFor="edit-material-url">
              <input
                id="edit-material-url"
                type="url"
                className={INPUT_CLASS}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                maxLength={2048}
                required
              />
            </Field>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-xl border-2 border-foreground bg-destructive-soft p-3 font-bold"
            >
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={SECONDARY_ACTION_CLASS}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className={PRIMARY_ACTION_CLASS}
            >
              {saving ? <InlineSpinner label="Đang lưu" /> : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
