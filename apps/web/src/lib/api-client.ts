const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:2222/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const API_ERROR_EVENT = "zunibee:api-error";

export type ApiErrorEventDetail = {
  message: string;
  status: number;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
  guestToken?: string;
  /** Dùng cho lỗi dự kiến như refresh 401 hoặc polling job chưa được tạo. */
  suppressGlobalError?: boolean;
};

const STATUS_MESSAGES: Partial<Record<number, string>> = {
  400: "Dữ liệu gửi lên không hợp lệ.",
  401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy dữ liệu yêu cầu.",
  409: "Dữ liệu đã tồn tại hoặc vừa được thay đổi.",
  413: "Tệp tải lên vượt quá dung lượng cho phép.",
  415: "Định dạng dữ liệu không được hỗ trợ.",
  422: "Không thể xử lý dữ liệu đã gửi.",
  429: "Bạn thao tác quá nhanh. Vui lòng chờ một lúc rồi thử lại.",
  500: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
  502: "Dịch vụ bên ngoài đang phản hồi không ổn định. Vui lòng thử lại sau.",
  503: "Dịch vụ đang tạm thời gián đoạn. Vui lòng thử lại sau.",
  504: "Yêu cầu mất quá nhiều thời gian xử lý. Vui lòng thử lại.",
};

/**
 * Gọi API backend. Luôn gửi kèm cookie (refresh token httpOnly) qua `credentials: "include"`.
 * Ném ApiError với message tiếng Việt lấy từ response body khi request thất bại.
 */
export async function apiFetch<T>(
  path: string,
  {
    method = "GET",
    body,
    accessToken,
    guestToken,
    suppressGlobalError = false,
  }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
  };
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  if (guestToken) headers["X-Guest-Token"] = guestToken;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body:
        body === undefined
          ? undefined
          : isFormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    const error = createNetworkApiError(suppressGlobalError);
    throw error;
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new ApiError(
      resolveApiErrorMessage(res.status, data),
      res.status,
    );
    if (!suppressGlobalError) dispatchApiError(error);
    throw error;
  }

  return data as T;
}

export function resolveApiErrorMessage(
  status: number,
  payload: unknown,
  fallback?: string,
): string {
  if (status === 429) return STATUS_MESSAGES[429]!;
  const candidate = extractMessage(payload);
  if (candidate && isVietnameseMessage(candidate)) return candidate;
  return (
    fallback ??
    STATUS_MESSAGES[status] ??
    "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau."
  );
}

export async function apiErrorFromResponse(
  response: Response,
  fallback?: string,
): Promise<ApiError> {
  const payload = await response.json().catch(() => null);
  const error = new ApiError(
    resolveApiErrorMessage(response.status, payload, fallback),
    response.status,
  );
  dispatchApiError(error);
  return error;
}

export function createNetworkApiError(suppressGlobalError = false): ApiError {
  const error = new ApiError(
    "Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.",
    0,
  );
  if (!suppressGlobalError) dispatchApiError(error);
  return error;
}

export function getUserErrorMessage(
  error: unknown,
  fallback = "Có lỗi xảy ra. Vui lòng thử lại.",
): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && isVietnameseMessage(error.message))
    return error.message;
  return fallback;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string") return message.trim() || null;
  if (Array.isArray(message)) {
    const first = message.find(
      (item): item is string =>
        typeof item === "string" && Boolean(item.trim()),
    );
    return first?.trim() ?? null;
  }
  return null;
}

function isVietnameseMessage(message: string): boolean {
  if (
    /\b(?:Exception|Error|Bad Request|Unauthorized|Forbidden|Not Found)\b/i.test(
      message,
    )
  )
    return false;
  if (
    /\b(?:must|should|invalid|unexpected|failed|too many requests)\b/i.test(
      message,
    )
  )
    return false;
  return /[À-ỹĐđ]/u.test(message);
}

function dispatchApiError(error: ApiError): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ApiErrorEventDetail>(API_ERROR_EVENT, {
      detail: { message: error.message, status: error.status },
    }),
  );
}

export { API_URL };
