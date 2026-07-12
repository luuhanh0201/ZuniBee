export type ParsedEmailBatch = {
  emails: string[];
  invalidEmails: string[];
  duplicateEmails: string[];
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailBatch(value: string): ParsedEmailBatch {
  const tokens = value
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const emails: string[] = [];
  const invalidEmails: string[] = [];
  const duplicateEmails: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (!EMAIL_PATTERN.test(token)) {
      if (!invalidEmails.includes(token)) invalidEmails.push(token);
      continue;
    }
    if (seen.has(token)) {
      if (!duplicateEmails.includes(token)) duplicateEmails.push(token);
      continue;
    }
    seen.add(token);
    emails.push(token);
  }

  return { emails, invalidEmails, duplicateEmails };
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Có lỗi xảy ra, vui lòng thử lại";
}
