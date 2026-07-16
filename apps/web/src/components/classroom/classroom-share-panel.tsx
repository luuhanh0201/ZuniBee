"use client";

import { useRef, useState } from "react";
import {
  Check,
  Clipboard,
  Download,
  Link2,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/components/ui/toast-provider";
import {
  InlineSpinner,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "./classroom-ui";

type CopiedField = "code" | "link" | null;

export function ClassroomSharePanel({
  classroomName,
  joinCode,
  joinUrl,
  onRegenerate,
  isRegenerating = false,
}: {
  classroomName: string;
  joinCode: string;
  joinUrl: string;
  onRegenerate?: () => Promise<void> | void;
  isRegenerating?: boolean;
}) {
  const { showToast } = useToast();
  const [copiedField, setCopiedField] = useState<CopiedField>(null);
  const copyLockRef = useRef(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  async function copyText(value: string, field: Exclude<CopiedField, null>) {
    if (copyLockRef.current) return;
    copyLockRef.current = true;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      showToast(
        "success",
        field === "code" ? "Đã sao chép mã lớp" : "Đã sao chép link lớp",
      );
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      showToast("error", "Không thể sao chép. Vui lòng sao chép thủ công.");
    } finally {
      copyLockRef.current = false;
    }
  }

  function downloadQrCode() {
    const svg = qrContainerRef.current?.querySelector("svg");
    if (!svg) {
      showToast("error", "Chưa thể tải mã QR, vui lòng thử lại");
      return;
    }

    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], {
      type: "image/svg+xml;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${toFileName(classroomName)}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    showToast("success", "Đã tải mã QR của lớp");
  }

  async function handleRegenerate() {
    if (!onRegenerate || isRegenerating) return;
    const confirmed = window.confirm(
      "Tạo mã mới sẽ làm mã và link cũ không còn sử dụng được. Bạn có muốn tiếp tục?",
    );
    if (confirmed) await onRegenerate();
  }

  return (
    <section
      className="rounded-2xl border border-divider bg-surface p-5 sm:p-6"
      aria-labelledby="share-classroom-heading"
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="editorial-label mb-2">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Chia sẻ an toàn
          </div>
          <h2
            id="share-classroom-heading"
            className="font-display text-2xl font-bold"
          >
            Mời sinh viên vào lớp
          </h2>
          <p className="mt-1 font-semibold text-muted-foreground">
            Sinh viên có thể nhập mã, mở link hoặc quét QR. Cả ba cách đều dẫn
            tới cùng lớp học.
          </p>
        </div>
        {onRegenerate ? (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className={`${SECONDARY_ACTION_CLASS} shrink-0`}
          >
            {isRegenerating ? (
              <InlineSpinner label="Đang tạo mã" />
            ) : (
              <>
                <RefreshCw className="h-5 w-5" aria-hidden="true" />
                Tạo mã mới
              </>
            )}
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-5">
          <div>
            <p className="mb-2 flex items-center gap-2 font-extrabold">
              <Clipboard className="h-5 w-5" aria-hidden="true" />
              Mã lớp
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <output
                aria-label="Mã tham gia lớp"
                className="flex min-h-16 min-w-0 flex-1 items-center justify-center rounded-xl border border-divider bg-primary-soft px-4 py-3 text-center font-display text-2xl font-bold tracking-[0.22em] sm:text-3xl"
              >
                {joinCode}
              </output>
              <button
                type="button"
                onClick={() => copyText(joinCode, "code")}
                className={PRIMARY_ACTION_CLASS}
              >
                {copiedField === "code" ? (
                  <Check className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Clipboard className="h-5 w-5" aria-hidden="true" />
                )}
                {copiedField === "code" ? "Đã chép" : "Sao chép mã"}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 font-extrabold">
              <Link2 className="h-5 w-5" aria-hidden="true" />
              Link tham gia
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <output
                aria-label="Link tham gia lớp"
                className="flex min-h-14 min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-divider bg-surface-soft px-4 py-3 font-semibold"
              >
                <span className="truncate">{joinUrl}</span>
              </output>
              <button
                type="button"
                onClick={() => copyText(joinUrl, "link")}
                className={SECONDARY_ACTION_CLASS}
              >
                {copiedField === "link" ? (
                  <Check className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Link2 className="h-5 w-5" aria-hidden="true" />
                )}
                {copiedField === "link" ? "Đã chép" : "Sao chép link"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center rounded-2xl border border-divider bg-surface-soft p-4">
          <p className="mb-3 flex items-center gap-2 font-extrabold">
            <QrCode className="h-5 w-5" aria-hidden="true" />
            Mã QR
          </p>
          <div
            ref={qrContainerRef}
            className="rounded-xl border border-divider bg-white p-3"
          >
            <QRCodeSVG
              value={joinUrl}
              size={168}
              level="M"
              marginSize={1}
              title={`Mã QR tham gia lớp ${classroomName}`}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>
          <button
            type="button"
            onClick={downloadQrCode}
            className={`${SECONDARY_ACTION_CLASS} mt-4 w-full`}
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            Tải mã QR
          </button>
        </div>
      </div>
    </section>
  );
}

function toFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "zunibee-classroom"
  );
}
