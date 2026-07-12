const LOCAL_ORIGIN = "https://zunibee.local";
const MAX_RETURN_TO_LENGTH = 2048;
const AUTH_RETURN_TO_STORAGE_KEY = "zunibee-auth-return-to";

/**
 * Chỉ nhận đường dẫn nội bộ. URL tuyệt đối, protocol-relative và dấu gạch chéo
 * ngược đều bị loại để không biến `returnTo` thành open redirect.
 */
export function getSafeReturnTo(
  value: string | string[] | null | undefined,
): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return undefined;

  const trimmed = candidate.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_RETURN_TO_LENGTH ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\")
  ) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed, LOCAL_ORIGIN);
    if (parsed.origin !== LOCAL_ORIGIN) return undefined;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

export function withReturnTo(path: string, returnTo?: string): string {
  if (!returnTo) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

export function storeAuthReturnTo(returnTo?: string): void {
  if (typeof window === "undefined") return;
  const safeReturnTo = getSafeReturnTo(returnTo);
  if (safeReturnTo) {
    sessionStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, safeReturnTo);
  } else {
    sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
  }
}

export function getStoredAuthReturnTo(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const safeReturnTo = getSafeReturnTo(
    sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY),
  );
  if (!safeReturnTo) {
    sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
  }
  return safeReturnTo;
}

export function clearStoredAuthReturnTo(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
  }
}
