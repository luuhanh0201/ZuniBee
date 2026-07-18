import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import type { AiUsageSource } from '@zunibee/shared';
import type { AiProviderEntity } from './entities/ai-provider.entity';
import { AiProviderService } from './ai-provider.service';
import { AiProviderUrlPolicyService } from './ai-provider-url-policy.service';
import { AiUsageService } from './ai-usage.service';
import {
  AiProviderSdkError,
  AiProviderSdkService,
} from './ai-provider-sdk.service';
import {
  AiRequestError,
  categoryFromProviderFailure,
  isRetryableHttpStatus,
  sanitizeProviderMessage,
  type AiErrorCategory,
} from './ai-error';
import {
  resolveStructuredOutput,
  supportsPdfNativeInput,
  type AiJsonSchema,
  type AiStructuredOutputPlan,
} from './ai-structured-output.adapter';
import {
  pdfPagesOutputSchema,
  pdfPagesSystemPrompt,
  pdfPagesUserPrompt,
  visionOcrSystemPrompt,
  visionOcrUserPrompt,
} from '@/modules/ai/prompts/vision-ocr.prompt';

export type AiCompletion = {
  value: unknown;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Bắt buộc với mọi lời gọi completeJson để luồng AI mới không thể quên
 * khai báo nguồn usage cho thống kê token/chi phí.
 */
export type AiUsageContext = {
  source: AiUsageSource;
  referenceId: string | null;
  userId: string | null;
  /** Chỉ dùng trong process worker; tuyệt đối không ghi vào usage event. */
  abortSignal?: AbortSignal;
};

export type { AiJsonSchema } from './ai-structured-output.adapter';

@Injectable()
export class AiModelClientService {
  private readonly logger = new Logger(AiModelClientService.name);

  constructor(
    private readonly providers: AiProviderService,
    private readonly urlPolicy: AiProviderUrlPolicyService,
    private readonly usage: AiUsageService,
    private readonly sdk: AiProviderSdkService,
  ) {}
  async completeJson(
    provider: AiProviderEntity,
    system: string,
    prompt: string,
    usageContext: AiUsageContext,
    outputSchema: AiJsonSchema,
  ): Promise<AiCompletion> {
    const request = requestAbortController(120_000, usageContext.abortSignal);
    const { abortSignal: _abortSignal, ...usageRecordContext } = usageContext;
    const startedAt = Date.now();
    let usageRecorded = false;
    let apiKey: string | null = null;
    try {
      await this.urlPolicy.assertAllowed(provider.kind, provider.baseUrl);
      apiKey = this.providers.apiKey(provider);
      const plan = resolveStructuredOutput(provider, outputSchema);
      const effectivePrompt = plan.promptInstruction
        ? `${prompt}${plan.promptInstruction}`
        : prompt;
      const reply = await this.sdk.generate({
        provider,
        apiKey,
        system,
        prompt: effectivePrompt,
        plan,
        maxOutputTokens: 16_384,
        temperature: 0.2,
        timeoutMs: 120_000,
        signal: request.signal,
      });
      let status: 'success' | 'refused' | 'invalid_output' = 'success';
      let category: AiErrorCategory | null = null;
      let errorMessage: string | null = null;
      let value: unknown;
      if (reply.refused) {
        status = 'refused';
        category = 'provider_refusal';
        errorMessage = 'Provider AI từ chối yêu cầu';
      } else if (reply.truncated) {
        status = 'invalid_output';
        category = 'invalid_json_output';
        errorMessage = 'Provider AI dừng vì vượt giới hạn output token';
      } else if (!reply.content) {
        status = 'invalid_output';
        category = 'invalid_json_output';
        errorMessage = 'Provider AI không trả nội dung hợp lệ';
      } else {
        try {
          value = parseJsonContent(reply.content);
        } catch (error) {
          status = 'invalid_output';
          category = 'invalid_json_output';
          errorMessage =
            error instanceof Error
              ? error.message
              : 'Provider AI trả JSON không hợp lệ';
        }
      }
      await this.usage.recordSafely({
        provider,
        ...usageRecordContext,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        cacheInputTokens: reply.cacheInputTokens,
        cacheWriteTokens: reply.cacheWriteTokens,
        reasoningTokens: reply.reasoningTokens,
        providerCostUsd: reply.providerCostUsd,
        providerRequestId: reply.providerRequestId,
        status,
        latencyMs: Date.now() - startedAt,
        httpStatus: reply.httpStatus,
        finishReason: reply.finishReason,
        errorCode: category,
        errorMessage,
      });
      usageRecorded = true;
      if (errorMessage) {
        this.logger.warn(
          `AI completion invalid: provider=${provider.name} model=${provider.model} mode=${plan.mode} category=${category} finishReason=${reply.finishReason || 'none'} referenceId=${usageContext.referenceId ?? 'none'} message=${errorMessage}`,
        );
        throw new AiRequestError(errorMessage, {
          category: category ?? 'invalid_json_output',
          retryable: false,
          provider: provider.name,
          model: provider.model,
          statusCode: reply.httpStatus,
        });
      }
      return {
        value,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
      };
    } catch (error) {
      if (
        error instanceof AiRequestError ||
        error instanceof BadGatewayException
      )
        throw error;
      if (error instanceof AiProviderSdkError) {
        const detail = sanitizeProviderMessage(error.message, apiKey);
        const category = error.statusCode
          ? categoryFromProviderFailure(error.statusCode, detail)
          : 'request_failed';
        const message = error.statusCode
          ? `Provider AI trả lỗi (HTTP ${error.statusCode}): ${detail}`
          : `Không thể gọi provider AI: ${detail}`;
        await this.usage.recordSafely({
          provider,
          ...usageRecordContext,
          inputTokens: 0,
          outputTokens: 0,
          status: 'failed',
          latencyMs: Date.now() - startedAt,
          httpStatus: error.statusCode,
          errorCode: category,
          errorMessage: message,
          providerRequestId: error.providerRequestId,
        });
        usageRecorded = true;
        throw new AiRequestError(message, {
          category,
          retryable: error.statusCode
            ? isRetryableHttpStatus(error.statusCode)
            : true,
          provider: provider.name,
          model: provider.model,
          statusCode: error.statusCode ?? undefined,
          providerMessage: detail || null,
        });
      }
      if (!usageRecorded) {
        const timeout = error instanceof Error && error.name === 'AbortError';
        await this.usage.recordSafely({
          provider,
          ...usageRecordContext,
          inputTokens: 0,
          outputTokens: 0,
          status: timeout ? 'timeout' : 'failed',
          latencyMs: Date.now() - startedAt,
          errorCode: timeout ? 'provider_timeout' : 'request_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      const timeout = error instanceof Error && error.name === 'AbortError';
      throw new AiRequestError(
        timeout
          ? 'Provider AI phản hồi quá thời gian 120 giây'
          : `Không thể gọi provider AI: ${error instanceof Error ? error.message : String(error)}`,
        {
          category: timeout ? 'provider_timeout' : 'request_failed',
          retryable: true,
          provider: provider.name,
          model: provider.model,
        },
      );
    } finally {
      request.close();
    }
  }

  /** Chuẩn hóa lỗi SDK, giữ request id và ghi usage thất bại đúng một lần. */
  private async sdkFailure(args: {
    error: AiProviderSdkError;
    provider: AiProviderEntity;
    apiKey: string | null;
    usageContext: AiUsageContext;
    startedAt: number;
    structuredOutputMode: AiStructuredOutputPlan['mode'] | null;
    messagePrefix?: string;
  }): Promise<AiRequestError> {
    const { error, provider } = args;
    const detail = sanitizeProviderMessage(error.message, args.apiKey);
    const category = error.statusCode
      ? categoryFromProviderFailure(error.statusCode, detail)
      : 'request_failed';
    const prefix = args.messagePrefix ?? 'Provider AI trả lỗi';
    const message = detail
      ? error.statusCode
        ? `${prefix} (HTTP ${error.statusCode}): ${detail}`
        : `${prefix}: ${detail}`
      : error.statusCode
        ? `${prefix} (HTTP ${error.statusCode})`
        : prefix;
    await this.usage.recordSafely({
      provider,
      ...args.usageContext,
      inputTokens: 0,
      outputTokens: 0,
      status: 'failed',
      latencyMs: Date.now() - args.startedAt,
      httpStatus: error.statusCode,
      errorCode: category,
      errorMessage: message,
      providerRequestId: error.providerRequestId,
    });
    this.logger.warn(
      `AI provider SDK request failed: provider=${provider.name} model=${provider.model} status=${error.statusCode ?? 'none'} category=${category} mode=${args.structuredOutputMode ?? 'none'} referenceId=${args.usageContext.referenceId ?? 'none'} message=${detail || 'không có body lỗi'}`,
    );
    return new AiRequestError(message, {
      category,
      retryable: error.statusCode
        ? isRetryableHttpStatus(error.statusCode)
        : true,
      provider: provider.name,
      model: provider.model,
      statusCode: error.statusCode ?? undefined,
      providerMessage: detail || null,
    });
  }

  /**
   * Chỉ dùng khi local OCR không đọc được một trang scan. Ảnh là dữ liệu
   * không tin cậy; model chỉ được phép chép lại chữ nhìn thấy trên trang.
   */
  async readImageText(
    provider: AiProviderEntity,
    image: Buffer,
    mediaType: 'image/png' | 'image/jpeg' | 'image/webp',
    usageContext: AiUsageContext,
    pageNumber: number,
  ): Promise<AiCompletion> {
    const request = requestAbortController(120_000, usageContext.abortSignal);
    const { abortSignal: _abortSignal, ...usageRecordContext } = usageContext;
    const startedAt = Date.now();
    let usageRecorded = false;
    let apiKey: string | null = null;
    try {
      await this.urlPolicy.assertAllowed(provider.kind, provider.baseUrl);
      apiKey = this.providers.apiKey(provider);
      const system = visionOcrSystemPrompt();
      const prompt = visionOcrUserPrompt();
      const reply = await this.sdk.generate({
        provider,
        apiKey,
        system,
        prompt,
        plan: { mode: 'prompt_json', schema: null, promptInstruction: null },
        attachment: { kind: 'image', data: image, mediaType },
        maxOutputTokens: 8_192,
        temperature: 0,
        timeoutMs: 120_000,
        signal: request.signal,
      });
      const normalized = reply.content ? normalizeText(reply.content) : '';
      let status: 'success' | 'refused' | 'invalid_output' = 'success';
      let category: AiErrorCategory | null = null;
      let errorMessage: string | null = null;
      if (reply.refused) {
        status = 'refused';
        category = 'provider_refusal';
        errorMessage = 'Provider AI từ chối đọc trang tài liệu';
      } else if (reply.truncated) {
        status = 'invalid_output';
        category = 'invalid_json_output';
        errorMessage = 'Provider AI dừng khi chưa đọc xong trang tài liệu';
      } else if (normalized.length < 10) {
        status = 'invalid_output';
        category = 'invalid_json_output';
        errorMessage = 'Model AI không trích xuất được chữ từ trang tài liệu';
      }
      await this.usage.recordSafely({
        provider,
        ...usageRecordContext,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        cacheInputTokens: reply.cacheInputTokens,
        cacheWriteTokens: reply.cacheWriteTokens,
        reasoningTokens: reply.reasoningTokens,
        providerCostUsd: reply.providerCostUsd,
        providerRequestId: reply.providerRequestId,
        status,
        latencyMs: Date.now() - startedAt,
        httpStatus: reply.httpStatus,
        finishReason: reply.finishReason,
        errorCode: category,
        errorMessage,
      });
      usageRecorded = true;
      this.logger.log(
        `AI vision OCR used: provider=${provider.name} model=${provider.model} page=${pageNumber} status=${status} inputTokens=${reply.inputTokens} outputTokens=${reply.outputTokens} cacheInputTokens=${reply.cacheInputTokens} latencyMs=${Date.now() - startedAt} referenceId=${usageContext.referenceId ?? 'none'}`,
      );
      if (errorMessage)
        throw new AiRequestError(errorMessage, {
          category: category ?? 'invalid_json_output',
          retryable: false,
          provider: provider.name,
          model: provider.model,
          statusCode: reply.httpStatus,
        });
      return {
        value: normalized.slice(0, 20_000),
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
      };
    } catch (error) {
      if (
        error instanceof AiRequestError ||
        error instanceof BadGatewayException
      )
        throw error;
      if (error instanceof AiProviderSdkError) {
        usageRecorded = true;
        throw await this.sdkFailure({
          error,
          provider,
          apiKey,
          usageContext: usageRecordContext,
          startedAt,
          structuredOutputMode: null,
          messagePrefix: 'Model AI không đọc được hình ảnh',
        });
      }
      if (!usageRecorded) {
        const timeout = error instanceof Error && error.name === 'AbortError';
        await this.usage.recordSafely({
          provider,
          ...usageRecordContext,
          inputTokens: 0,
          outputTokens: 0,
          status: timeout ? 'timeout' : 'failed',
          latencyMs: Date.now() - startedAt,
          errorCode: timeout ? 'provider_timeout' : 'request_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      const timeout = error instanceof Error && error.name === 'AbortError';
      throw new AiRequestError(
        timeout
          ? 'Provider AI đọc ảnh quá thời gian 120 giây'
          : `Không thể dùng AI đọc ảnh: ${error instanceof Error ? error.message : String(error)}`,
        {
          category: timeout ? 'provider_timeout' : 'request_failed',
          retryable: true,
          provider: provider.name,
          model: provider.model,
        },
      );
    } finally {
      request.close();
    }
  }

  /**
   * AI đọc trực tiếp một mini PDF (đã tách theo page range hợp lệ) và trả
   * text theo pageNumber GỐC. Chỉ gọi khi supportsPdfNativeInput(provider);
   * PDF là dữ liệu không đáng tin như ảnh — model chỉ được chép lại chữ.
   */
  async readPdfPagesText(
    provider: AiProviderEntity,
    pdf: Buffer,
    pageNumbers: number[],
    usageContext: AiUsageContext,
  ): Promise<{
    pages: Map<number, string>;
    inputTokens: number;
    outputTokens: number;
  }> {
    const request = requestAbortController(180_000, usageContext.abortSignal);
    const { abortSignal: _abortSignal, ...usageRecordContext } = usageContext;
    const startedAt = Date.now();
    let usageRecorded = false;
    let apiKey: string | null = null;
    try {
      if (!supportsPdfNativeInput(provider))
        throw new AiRequestError(
          `Provider ${provider.name} không hỗ trợ đọc PDF trực tiếp`,
          {
            category: 'provider_schema_error',
            retryable: false,
            provider: provider.name,
            model: provider.model,
          },
        );
      await this.urlPolicy.assertAllowed(provider.kind, provider.baseUrl);
      apiKey = this.providers.apiKey(provider);
      const schema = pdfPagesOutputSchema(pageNumbers);
      const plan = resolveStructuredOutput(provider, schema);
      const system = pdfPagesSystemPrompt();
      const prompt = plan.promptInstruction
        ? `${pdfPagesUserPrompt(pageNumbers)}${plan.promptInstruction}`
        : pdfPagesUserPrompt(pageNumbers);
      const reply = await this.sdk.generate({
        provider,
        apiKey,
        system,
        prompt,
        plan,
        attachment: {
          kind: 'pdf',
          data: pdf,
          mediaType: 'application/pdf',
        },
        maxOutputTokens: 16_384,
        temperature: 0.2,
        timeoutMs: 180_000,
        signal: request.signal,
      });
      let status: 'success' | 'refused' | 'invalid_output' = 'success';
      let category: AiErrorCategory | null = null;
      let errorMessage: string | null = null;
      let pages: Map<number, string> | null = null;
      if (reply.refused) {
        status = 'refused';
        category = 'provider_refusal';
        errorMessage = 'Provider AI từ chối đọc tài liệu PDF';
      } else if (reply.truncated) {
        status = 'invalid_output';
        category = 'invalid_json_output';
        errorMessage =
          'Provider AI dừng vì vượt giới hạn output token khi đọc PDF';
      } else if (!reply.content) {
        status = 'invalid_output';
        category = 'invalid_json_output';
        errorMessage = 'Provider AI không trả nội dung khi đọc PDF';
      } else {
        try {
          pages = parsePdfPagesReply(reply.content, pageNumbers);
        } catch (error) {
          status = 'invalid_output';
          category = 'invalid_json_output';
          errorMessage =
            error instanceof Error
              ? error.message
              : 'Provider AI trả JSON đọc PDF không hợp lệ';
        }
      }
      await this.usage.recordSafely({
        provider,
        ...usageRecordContext,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        cacheInputTokens: reply.cacheInputTokens,
        cacheWriteTokens: reply.cacheWriteTokens,
        reasoningTokens: reply.reasoningTokens,
        providerCostUsd: reply.providerCostUsd,
        providerRequestId: reply.providerRequestId,
        status,
        latencyMs: Date.now() - startedAt,
        httpStatus: reply.httpStatus,
        finishReason: reply.finishReason,
        errorCode: category,
        errorMessage,
      });
      usageRecorded = true;
      this.logger.log(
        `AI PDF read used: provider=${provider.name} model=${provider.model} pages=[${pageNumbers.join(',')}] status=${status} inputTokens=${reply.inputTokens} outputTokens=${reply.outputTokens} latencyMs=${Date.now() - startedAt} referenceId=${usageContext.referenceId ?? 'none'}`,
      );
      if (errorMessage || !pages)
        throw new AiRequestError(
          errorMessage ?? 'Provider AI trả JSON đọc PDF không hợp lệ',
          {
            category: category ?? 'invalid_json_output',
            retryable: false,
            provider: provider.name,
            model: provider.model,
            statusCode: reply.httpStatus,
          },
        );
      return {
        pages,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
      };
    } catch (error) {
      if (
        error instanceof AiRequestError ||
        error instanceof BadGatewayException
      )
        throw error;
      if (error instanceof AiProviderSdkError) {
        usageRecorded = true;
        throw await this.sdkFailure({
          error,
          provider,
          apiKey,
          usageContext: usageRecordContext,
          startedAt,
          structuredOutputMode: null,
          messagePrefix: 'Model AI không đọc được PDF',
        });
      }
      if (!usageRecorded) {
        const timeout = error instanceof Error && error.name === 'AbortError';
        await this.usage.recordSafely({
          provider,
          ...usageRecordContext,
          inputTokens: 0,
          outputTokens: 0,
          status: timeout ? 'timeout' : 'failed',
          latencyMs: Date.now() - startedAt,
          errorCode: timeout ? 'provider_timeout' : 'request_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      const timeout = error instanceof Error && error.name === 'AbortError';
      throw new AiRequestError(
        timeout
          ? 'Provider AI đọc PDF quá thời gian 180 giây'
          : `Không thể dùng AI đọc PDF: ${error instanceof Error ? error.message : String(error)}`,
        {
          category: timeout ? 'provider_timeout' : 'request_failed',
          retryable: true,
          provider: provider.name,
          model: provider.model,
        },
      );
    } finally {
      request.close();
    }
  }
}

export function parsePdfPagesReply(
  content: string,
  expectedPageNumbers: number[],
): Map<number, string> {
  const parsed = parseJsonContent(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Kết quả đọc PDF phải là JSON object');
  const pages = (parsed as { pages?: unknown }).pages;
  if (!Array.isArray(pages) || pages.length !== expectedPageNumbers.length)
    throw new Error(
      `Kết quả đọc PDF phải có đúng ${expectedPageNumbers.length} trang`,
    );
  const expected = new Set(expectedPageNumbers);
  const result = new Map<number, string>();
  pages.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error(`pages[${index}] phải là object`);
    const pageNumber = Number((raw as { pageNumber?: unknown }).pageNumber);
    const text = (raw as { text?: unknown }).text;
    if (!Number.isInteger(pageNumber) || !expected.has(pageNumber))
      throw new Error(`pages[${index}].pageNumber không thuộc batch nguồn`);
    if (result.has(pageNumber))
      throw new Error(`pageNumber ${pageNumber} bị trả trùng`);
    if (typeof text !== 'string')
      throw new Error(`pages[${index}].text phải là chuỗi`);
    result.set(pageNumber, normalizeText(text).slice(0, 20_000));
  });
  for (const pageNumber of expectedPageNumbers) {
    if (!result.has(pageNumber))
      throw new Error(`Thiếu kết quả cho trang ${pageNumber}`);
  }
  return result;
}

/** Kết hợp timeout riêng của request với tín hiệu pause từ AI worker. */
function requestAbortController(timeoutMs: number, external?: AbortSignal): {
  signal: AbortSignal;
  close: () => void;
} {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (external?.aborted) abort();
  else external?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  return {
    signal: controller.signal,
    close: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', abort);
    },
  };
}

// Giữ xuống dòng để không phá cấu trúc bảng/hàng mà prompt OCR yêu cầu,
// chỉ nén khoảng trắng thừa trong dòng và dòng trống liên tiếp.
function normalizeText(value: string): string {
  return value
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseJsonContent(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new BadGatewayException('Provider AI trả JSON không hợp lệ');
  }
}
