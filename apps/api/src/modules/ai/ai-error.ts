import { BadGatewayException } from '@nestjs/common';

/**
 * Phân loại lỗi của luồng AI để quyết định retry và chẩn đoán nguyên nhân.
 * - provider_schema_error / provider_auth_error / provider_refusal: lỗi cố định,
 *   retry cùng payload không thể tự phục hồi.
 * - provider_rate_limit / provider_server_error / provider_timeout /
 *   request_failed: lỗi tạm thời, được phép retry với backoff.
 * - invalid_json_output / canonical_validation_error: nội dung AI sai — xử lý
 *   bằng một lần repair có hướng dẫn, không retry request thông thường.
 */
export type AiErrorCategory =
  | 'provider_schema_error'
  | 'provider_auth_error'
  | 'provider_rate_limit'
  | 'provider_server_error'
  | 'provider_timeout'
  | 'provider_refusal'
  | 'invalid_json_output'
  | 'canonical_validation_error'
  | 'request_failed';

export type AiRequestErrorDetails = {
  category: AiErrorCategory;
  retryable: boolean;
  provider: string | null;
  model: string | null;
  statusCode: number | null;
  /** Thông báo lỗi gốc từ provider, đã sanitize và cắt ngắn. */
  providerMessage: string | null;
  /** Danh sách lỗi validation kèm đường dẫn field, ví dụ questions[2].options. */
  validationIssues: string[];
};

/** Cấu trúc lỗi lưu vào ai_generation_jobs.error_details để chẩn đoán. */
export type AiGenerationErrorDetails = AiRequestErrorDetails & {
  stage: string;
  message: string;
};

/**
 * Lỗi có phân loại cho mọi bước gọi/validate AI. Kế thừa BadGatewayException
 * để controller hiện tại vẫn trả HTTP 502 như trước.
 */
export class AiRequestError extends BadGatewayException {
  readonly details: AiRequestErrorDetails;

  constructor(message: string, details: Partial<AiRequestErrorDetails>) {
    super(message);
    this.details = {
      category: details.category ?? 'request_failed',
      retryable: details.retryable ?? true,
      provider: details.provider ?? null,
      model: details.model ?? null,
      statusCode: details.statusCode ?? null,
      providerMessage: details.providerMessage ?? null,
      validationIssues: details.validationIssues ?? [],
    };
  }
}

/** HTTP status → category; 4xx (trừ 408/429) là lỗi cố định không retry. */
export function categoryFromHttpStatus(status: number): AiErrorCategory {
  if (status === 401 || status === 403) return 'provider_auth_error';
  if (status === 429) return 'provider_rate_limit';
  if (status === 408) return 'provider_timeout';
  if (status >= 500) return 'provider_server_error';
  return 'provider_schema_error';
}

/**
 * Một số provider (đặc biệt Anthropic vision) trả content-policy dưới dạng
 * HTTP 400 `invalid_request_error`. Đây là refusal theo nội dung, không phải
 * request sai schema; cần nhận diện bằng body lỗi trước khi áp mapping HTTP.
 */
export function categoryFromProviderFailure(
  status: number,
  providerMessage: string,
): AiErrorCategory {
  return isContentPolicyMessage(providerMessage)
    ? 'provider_refusal'
    : categoryFromHttpStatus(status);
}

export function isContentPolicyMessage(message: string): boolean {
  const normalized = message.toLocaleLowerCase('en-US');
  return [
    'content filter',
    'content_filter',
    'content policy',
    'content_policy',
    'blocked for safety',
    'blocked by safety',
    'safety policy',
    'safety_policy',
    'responsible ai policy',
    'prohibited content',
  ].some((marker) => normalized.includes(marker));
}

/** Chỉ cho phép bỏ qua trang ảnh khi provider xác nhận chặn bởi policy. */
export function isContentPolicyError(error: unknown): boolean {
  if (!(error instanceof AiRequestError)) return false;
  return (
    error.details.category === 'provider_refusal' &&
    isContentPolicyMessage(
      error.details.providerMessage ??
        (error instanceof Error ? error.message : ''),
    )
  );
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Lỗi không thể tự phục hồi bằng retry: request/schema cố định, nội dung AI
 * sai (đã qua repair) hoặc dữ liệu đầu vào không hợp lệ (BadRequestException).
 */
export function isNonRetryableAiError(error: unknown): boolean {
  if (error instanceof AiRequestError) return !error.details.retryable;
  if (error instanceof Error)
    return (
      error.name === 'BadRequestException' || error.name === 'NotFoundException'
    );
  return false;
}

/**
 * Rút thông báo lỗi thật từ body provider (OpenAI/Anthropic/Ollama đều bọc
 * khác nhau); giữ nguyên raw khi không parse được JSON.
 */
export function providerErrorMessage(rawBody: string): string {
  const trimmed = rawBody.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: unknown; type?: unknown } | string;
      message?: unknown;
      detail?: unknown;
    };
    if (typeof parsed.error === 'string' && parsed.error) return parsed.error;
    if (parsed.error && typeof parsed.error === 'object') {
      const message = parsed.error.message;
      const type = parsed.error.type;
      if (typeof message === 'string' && message)
        return typeof type === 'string' && type
          ? `${type}: ${message}`
          : message;
    }
    if (typeof parsed.message === 'string' && parsed.message)
      return parsed.message;
    if (typeof parsed.detail === 'string' && parsed.detail)
      return parsed.detail;
  } catch {
    /* body không phải JSON — dùng raw */
  }
  return trimmed;
}

/** Che API key nếu vô tình xuất hiện trong log/message và cắt độ dài an toàn. */
export function sanitizeProviderMessage(
  message: string,
  apiKey: string | null | undefined,
  maxLength = 600,
): string {
  const masked = apiKey
    ? message.split(apiKey).join('[đã che api key]')
    : message;
  return masked.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
