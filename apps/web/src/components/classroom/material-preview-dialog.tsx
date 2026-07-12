"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileQuestion, Loader2, X } from "lucide-react";
import type { ClassroomMaterial } from "@zunibee/shared";
import { useToast } from "@/components/ui/toast-provider";
import {
  downloadClassroomMaterial,
  fetchClassroomMaterialBlob,
} from "./classroom-api";
import { SECONDARY_ACTION_CLASS } from "./classroom-ui";
import { getErrorMessage } from "./classroom-utils";

type PreviewKind = "pdf" | "image" | "text" | "docx" | "xlsx" | "unsupported";

function getPreviewKind(material: ClassroomMaterial): PreviewKind {
  const mime = material.mimeType ?? "";
  const name = material.originalName?.toLowerCase() ?? "";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime === "text/plain" || name.endsWith(".txt")) return "text";
  if (mime.includes("wordprocessingml") || name.endsWith(".docx"))
    return "docx";
  if (mime.includes("spreadsheetml") || name.endsWith(".xlsx")) return "xlsx";
  return "unsupported";
}

export function MaterialPreviewDialog({
  classroomId,
  material,
  accessToken,
  onClose,
}: {
  classroomId: string;
  material: ClassroomMaterial;
  accessToken?: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const previewKind = getPreviewKind(material);
  const canPreview = material.type === "file" && previewKind !== "unsupported";
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [workbookSheets, setWorkbookSheets] = useState<
    Record<string, unknown[][]>
  >({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [sheetRows, setSheetRows] = useState<unknown[][]>([]);
  const [isLoading, setIsLoading] = useState(canPreview);
  const [isSheetLoading, setIsSheetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    if (!canPreview) return;

    fetchClassroomMaterialBlob(classroomId, material, accessToken)
      .then(async (blob) => {
        if (previewKind === "docx") {
          const [{ default: mammoth }, { default: DOMPurify }] =
            await Promise.all([import("mammoth"), import("dompurify")]);
          const result = await mammoth.convertToHtml({
            arrayBuffer: await blob.arrayBuffer(),
          });
          if (!disposed) setDocxHtml(DOMPurify.sanitize(result.value));
          return;
        }
        if (previewKind === "xlsx") {
          const { default: readXlsxFile } =
            await import("read-excel-file/browser");
          const sheets = await readXlsxFile(blob);
          const names = sheets.map((sheet) => sheet.sheet);
          const firstSheet = names[0] ?? null;
          const byName = Object.fromEntries(
            sheets.map((sheet) => [sheet.sheet, sheet.data]),
          );
          if (!disposed) {
            setWorkbookSheets(byName);
            setSheetNames(names);
            setActiveSheet(firstSheet);
            setSheetRows(firstSheet ? byName[firstSheet] : []);
          }
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        if (!disposed) setBlobUrl(objectUrl);
      })
      .catch((requestError: unknown) => {
        if (!disposed) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!disposed) setIsLoading(false);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, canPreview, classroomId, material, previewKind]);

  function handleSheetChange(sheetName: string) {
    if (sheetName === activeSheet || isSheetLoading) return;
    setIsSheetLoading(true);
    setSheetRows(workbookSheets[sheetName] ?? []);
    setActiveSheet(sheetName);
    setIsSheetLoading(false);
  }

  async function handleDownload() {
    try {
      await downloadClassroomMaterial(classroomId, material, accessToken);
    } catch (requestError) {
      showToast("error", getErrorMessage(requestError));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/55 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-preview-title"
        className="flex h-[min(90dvh,56rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border-2 border-foreground bg-surface shadow-brutal-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-foreground px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2
              id="material-preview-title"
              className="truncate font-display text-lg font-extrabold sm:text-xl"
            >
              {material.title}
            </h2>
            <p className="truncate text-sm font-semibold text-muted-foreground">
              {material.originalName || "Xem trước tài liệu"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {material.type === "link" && material.url ? (
              <a
                href={material.url}
                target="_blank"
                rel="noreferrer"
                className={`${SECONDARY_ACTION_CLASS} min-h-10 px-3 py-2 text-sm`}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Mở liên kết</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void handleDownload()}
                className={`${SECONDARY_ACTION_CLASS} min-h-10 px-3 py-2 text-sm`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Tải xuống</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng xem trước"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm hover:bg-destructive-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 bg-background p-3 sm:p-5">
          {isLoading ? (
            <Loading />
          ) : error ? (
            <Unavailable
              title="Không thể mở bản xem trước"
              description={error}
            />
          ) : material.type === "link" ? (
            <Unavailable
              title="Tài liệu là liên kết ngoài"
              description="Mở liên kết để xem nội dung tại trang nguồn."
            />
          ) : !canPreview ? (
            <Unavailable
              title="Định dạng chưa hỗ trợ xem trực tiếp"
              description="DOC và XLS đời cũ chưa thể render an toàn trong trình duyệt. Hãy tải xuống hoặc chuyển sang DOCX/XLSX."
            />
          ) : previewKind === "docx" && docxHtml ? (
            <DocxPreview html={docxHtml} />
          ) : previewKind === "xlsx" ? (
            <SpreadsheetPreview
              sheetNames={sheetNames}
              activeSheet={activeSheet}
              rows={sheetRows}
              isLoading={isSheetLoading}
              onSheetChange={handleSheetChange}
            />
          ) : previewKind === "image" && blobUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blobUrl}
              alt={material.title}
              className="h-full w-full object-contain"
            />
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              title={`Xem trước ${material.title}`}
              className="h-full w-full rounded-xl border-2 border-divider bg-white"
            />
          ) : (
            <Unavailable
              title="Không thể tạo bản xem trước"
              description="Bạn vẫn có thể tải tài liệu xuống để mở."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function Loading() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3"
      role="status"
    >
      <Loader2 className="h-9 w-9 animate-spin" aria-hidden="true" />
      <p className="font-bold">Đang tải bản xem trước...</p>
    </div>
  );
}

function DocxPreview({ html }: { html: string }) {
  return (
    <article
      className="mx-auto h-full max-w-4xl overflow-auto rounded-xl border-2 border-divider bg-white p-6 text-slate-900 shadow-sm sm:p-10 [&_a]:text-blue-700 [&_a]:underline [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-bold [&_li]:ml-6 [&_ol]:list-decimal [&_p]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:p-2 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function SpreadsheetPreview({
  sheetNames,
  activeSheet,
  rows,
  isLoading,
  onSheetChange,
}: {
  sheetNames: string[];
  activeSheet: string | null;
  rows: unknown[][];
  isLoading: boolean;
  onSheetChange: (name: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-divider bg-white text-slate-900">
      <div
        className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-300 bg-slate-100 p-2"
        role="tablist"
        aria-label="Các sheet trong tài liệu Excel"
      >
        {sheetNames.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={activeSheet === name}
            onClick={() => onSheetChange(name)}
            className={`min-h-9 shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-bold ${activeSheet === name ? "border-slate-900 bg-white" : "border-slate-300 bg-slate-200 hover:bg-white"}`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 font-semibold text-slate-600">
            Sheet này chưa có dữ liệu.
          </div>
        ) : (
          <table className="min-w-full border-collapse text-left text-sm">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={
                    rowIndex === 0
                      ? "sticky top-0 bg-slate-100 font-bold"
                      : "even:bg-slate-50"
                  }
                >
                  <th
                    scope="row"
                    className="sticky left-0 border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs text-slate-500"
                  >
                    {rowIndex + 1}
                  </th>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="max-w-80 whitespace-pre-wrap border border-slate-300 px-3 py-2 align-top"
                    >
                      {formatCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleString("vi-VN");
  return String(value);
}

function Unavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-foreground bg-warning-soft shadow-brutal-sm">
        <FileQuestion className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-display text-xl font-extrabold">{title}</h3>
      <p className="mt-2 max-w-lg font-semibold text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
