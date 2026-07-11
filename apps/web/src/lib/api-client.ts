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

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
};

/**
 * Gọi API backend. Luôn gửi kèm cookie (refresh token httpOnly) qua `credentials: "include"`.
 * Ném ApiError với message tiếng Việt lấy từ response body khi request thất bại.
 */
export async function apiFetch<T>(
  path: string,
  { method = "GET", body, accessToken }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data &&
        (Array.isArray(data.message) ? data.message[0] : data.message)) ||
      "Có lỗi xảy ra, vui lòng thử lại";
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export { API_URL };
