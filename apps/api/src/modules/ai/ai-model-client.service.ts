import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import type { AiUsageSource } from '@zunibee/shared';
import {
  AiProviderKind,
  type AiProviderEntity,
} from './entities/ai-provider.entity';
import { AiProviderService } from './ai-provider.service';
import { AiProviderUrlPolicyService } from './ai-provider-url-policy.service';
import { AiUsageService } from './ai-usage.service';
import {
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
};

export type AiJsonSchema = Record<string, unknown>;

@Injectable()
export class AiModelClientService {
  private readonly logger = new Logger(AiModelClientService.name);

  constructor(
    private readonly providers: AiProviderService,
    private readonly urlPolicy: AiProviderUrlPolicyService,
    private readonly usage: AiUsageService,
  ) {}
  async completeJson(
    provider: AiProviderEntity,
    system: string,
    prompt: string,
    usageContext: AiUsageContext,
    outputSchema: AiJsonSchema,
  ): Promise<AiCompletion> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    const startedAt = Date.now();
    let usageRecorded = false;
    try {
      await this.urlPolicy.assertAllowed(provider.kind, provider.baseUrl);
      const apiKey = this.providers.apiKey(provider);
      const isAnthropic = isAnthropicApi(provider);
      const response =
        provider.kind === AiProviderKind.OLLAMA
          ? await fetch(`${trimTrailingSlashes(provider.baseUrl)}/api/chat`, {
              method: 'POST',
              redirect: 'error',
              signal: controller.signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: provider.model,
                stream: false,
                format: outputSchema,
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: prompt },
                ],
                options: { temperature: 0.2 },
              }),
            })
          : isAnthropic
            ? await fetch(`${trimTrailingSlashes(provider.baseUrl)}/messages`, {
                method: 'POST',
                redirect: 'error',
                signal: controller.signal,
                headers: {
                  'Content-Type': 'application/json',
                  'anthropic-version': '2023-06-01',
                  ...(apiKey ? { 'x-api-key': apiKey } : {}),
                },
                body: JSON.stringify({
                  model: provider.model,
                  max_tokens: 16_384,
                  system,
                  messages: [{ role: 'user', content: prompt }],
                  output_config: {
                    format: {
                      type: 'json_schema',
                      schema: outputSchema,
                    },
                  },
                }),
              })
            : await fetch(
                `${trimTrailingSlashes(provider.baseUrl)}/chat/completions`,
                {
                  method: 'POST',
                  redirect: 'error',
                  signal: controller.signal,
                  headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                  },
                  body: JSON.stringify(
                    compatibleRequestBody(
                      provider,
                      system,
                      prompt,
                      outputSchema,
                    ),
                  ),
                },
              );
      if (!response.ok) {
        await response.body?.cancel();
        await this.usage.recordSafely({
          provider,
          ...usageContext,
          inputTokens: 0,
          outputTokens: 0,
          status: 'failed',
          latencyMs: Date.now() - startedAt,
          httpStatus: response.status,
          errorCode: `HTTP_${response.status}`,
          errorMessage: `Provider AI trả lỗi HTTP ${response.status}`,
        });
        usageRecorded = true;
        throw new BadGatewayException(
          `Provider AI trả lỗi HTTP ${response.status}`,
        );
      }
      const body = (await response.json()) as unknown;
      const ollama = body as {
        message?: { content?: unknown };
        prompt_eval_count?: unknown;
        eval_count?: unknown;
        done_reason?: unknown;
      };
      const compatible = body as {
        choices?: Array<{
          message?: { content?: unknown; refusal?: unknown };
          finish_reason?: unknown;
        }>;
        usage?: {
          prompt_tokens?: unknown;
          completion_tokens?: unknown;
          prompt_tokens_details?: { cached_tokens?: unknown };
        };
      };
      const anthropic = body as {
        content?: Array<{ type?: unknown; text?: unknown }>;
        stop_reason?: unknown;
        usage?: {
          input_tokens?: unknown;
          output_tokens?: unknown;
          cache_creation_input_tokens?: unknown;
          cache_read_input_tokens?: unknown;
        };
      };
      const content =
        provider.kind === AiProviderKind.OLLAMA
          ? ollama.message?.content
          : isAnthropic
            ? anthropic.content?.find(
                (block) =>
                  block.type === 'text' && typeof block.text === 'string',
              )?.text
            : compatible.choices?.[0]?.message?.content;
      const inputTokens = Number(
        isAnthropic
          ? numericTokenCount(anthropic.usage?.input_tokens) +
              numericTokenCount(anthropic.usage?.cache_creation_input_tokens) +
              numericTokenCount(anthropic.usage?.cache_read_input_tokens)
          : (compatible.usage?.prompt_tokens ?? ollama.prompt_eval_count ?? 0),
      );
      const outputTokens = Number(
        (isAnthropic ? anthropic.usage?.output_tokens : undefined) ??
          compatible.usage?.completion_tokens ??
          ollama.eval_count ??
          0,
      );
      const cacheInputTokens = isAnthropic
        ? numericTokenCount(anthropic.usage?.cache_creation_input_tokens) +
          numericTokenCount(anthropic.usage?.cache_read_input_tokens)
        : numericTokenCount(
            compatible.usage?.prompt_tokens_details?.cached_tokens,
          );
      const finishReason =
        reasonText(isAnthropic ? anthropic.stop_reason : undefined) ??
        reasonText(compatible.choices?.[0]?.finish_reason) ??
        reasonText(ollama.done_reason) ??
        '';
      let status: 'success' | 'refused' | 'invalid_output' = 'success';
      let errorMessage: string | null = null;
      let value: unknown;
      if (
        (isAnthropic && anthropic.stop_reason === 'refusal') ||
        compatible.choices?.[0]?.message?.refusal
      ) {
        status = 'refused';
        errorMessage = 'Provider AI từ chối yêu cầu';
      } else if (
        isAnthropic &&
        (anthropic.stop_reason === 'max_tokens' ||
          anthropic.stop_reason === 'model_context_window_exceeded')
      ) {
        status = 'invalid_output';
        errorMessage = 'Provider AI dừng vì vượt giới hạn output token';
      } else if (typeof content !== 'string') {
        status = 'invalid_output';
        errorMessage = 'Provider AI không trả nội dung hợp lệ';
      } else {
        try {
          value = parseJsonContent(content);
        } catch (error) {
          status = 'invalid_output';
          errorMessage =
            error instanceof Error
              ? error.message
              : 'Provider AI trả JSON không hợp lệ';
        }
      }
      await this.usage.recordSafely({
        provider,
        ...usageContext,
        inputTokens,
        outputTokens,
        cacheInputTokens,
        status,
        latencyMs: Date.now() - startedAt,
        httpStatus: response.status,
        finishReason,
        errorCode: status === 'success' ? null : status.toUpperCase(),
        errorMessage,
      });
      usageRecorded = true;
      if (errorMessage) throw new BadGatewayException(errorMessage);
      return {
        value,
        inputTokens,
        outputTokens,
      };
    } catch (error) {
      if (!usageRecorded) {
        const timeout = error instanceof Error && error.name === 'AbortError';
        await this.usage.recordSafely({
          provider,
          ...usageContext,
          inputTokens: 0,
          outputTokens: 0,
          status: timeout ? 'timeout' : 'failed',
          latencyMs: Date.now() - startedAt,
          errorCode: timeout ? 'TIMEOUT' : 'REQUEST_FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        error instanceof Error && error.name === 'AbortError'
          ? 'Provider AI phản hồi quá thời gian 120 giây'
          : `Không thể gọi provider AI: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    const startedAt = Date.now();
    let usageRecorded = false;
    try {
      await this.urlPolicy.assertAllowed(provider.kind, provider.baseUrl);
      const apiKey = this.providers.apiKey(provider);
      const isAnthropic = isAnthropicApi(provider);
      const base64 = image.toString('base64');
      const system = visionOcrSystemPrompt();
      const prompt = visionOcrUserPrompt();
      const response =
        provider.kind === AiProviderKind.OLLAMA
          ? await fetch(`${trimTrailingSlashes(provider.baseUrl)}/api/chat`, {
              method: 'POST',
              redirect: 'error',
              signal: controller.signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: provider.model,
                stream: false,
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: prompt, images: [base64] },
                ],
                options: { temperature: 0 },
              }),
            })
          : isAnthropic
            ? await fetch(`${trimTrailingSlashes(provider.baseUrl)}/messages`, {
                method: 'POST',
                redirect: 'error',
                signal: controller.signal,
                headers: {
                  'Content-Type': 'application/json',
                  'anthropic-version': '2023-06-01',
                  ...(apiKey ? { 'x-api-key': apiKey } : {}),
                },
                body: JSON.stringify({
                  model: provider.model,
                  max_tokens: 8_192,
                  system,
                  messages: [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'image',
                          source: {
                            type: 'base64',
                            media_type: mediaType,
                            data: base64,
                          },
                        },
                        { type: 'text', text: prompt },
                      ],
                    },
                  ],
                }),
              })
            : await fetch(
                `${trimTrailingSlashes(provider.baseUrl)}/chat/completions`,
                {
                  method: 'POST',
                  redirect: 'error',
                  signal: controller.signal,
                  headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                  },
                  body: JSON.stringify({
                    model: provider.model,
                    messages: [
                      { role: 'system', content: system },
                      {
                        role: 'user',
                        content: [
                          { type: 'text', text: prompt },
                          {
                            type: 'image_url',
                            image_url: {
                              url: `data:${mediaType};base64,${base64}`,
                              detail: 'high',
                            },
                          },
                        ],
                      },
                    ],
                    ...(isOpenRouter(provider)
                      ? { provider: { require_parameters: true } }
                      : {}),
                  }),
                },
              );
      if (!response.ok) {
        await response.body?.cancel();
        await this.usage.recordSafely({
          provider,
          ...usageContext,
          inputTokens: 0,
          outputTokens: 0,
          status: 'failed',
          latencyMs: Date.now() - startedAt,
          httpStatus: response.status,
          errorCode: `HTTP_${response.status}`,
          errorMessage: `Model AI không đọc được hình ảnh (HTTP ${response.status})`,
        });
        usageRecorded = true;
        throw new BadGatewayException(
          `Model AI không đọc được hình ảnh (HTTP ${response.status}); hãy chọn model hỗ trợ vision`,
        );
      }

      const body = (await response.json()) as unknown;
      const ollama = body as {
        message?: { content?: unknown };
        prompt_eval_count?: unknown;
        eval_count?: unknown;
        done_reason?: unknown;
      };
      const compatible = body as {
        choices?: Array<{
          message?: { content?: unknown; refusal?: unknown };
          finish_reason?: unknown;
        }>;
        usage?: {
          prompt_tokens?: unknown;
          completion_tokens?: unknown;
          prompt_tokens_details?: { cached_tokens?: unknown };
        };
      };
      const anthropic = body as {
        content?: Array<{ type?: unknown; text?: unknown }>;
        stop_reason?: unknown;
        usage?: {
          input_tokens?: unknown;
          output_tokens?: unknown;
          cache_creation_input_tokens?: unknown;
          cache_read_input_tokens?: unknown;
        };
      };
      const content =
        provider.kind === AiProviderKind.OLLAMA
          ? ollama.message?.content
          : isAnthropic
            ? anthropic.content
                ?.filter(
                  (block) =>
                    block.type === 'text' && typeof block.text === 'string',
                )
                .map((block) => block.text)
                .join('\n')
            : extractCompatibleText(compatible.choices?.[0]?.message?.content);
      const inputTokens = isAnthropic
        ? numericTokenCount(anthropic.usage?.input_tokens) +
          numericTokenCount(anthropic.usage?.cache_creation_input_tokens) +
          numericTokenCount(anthropic.usage?.cache_read_input_tokens)
        : numericTokenCount(
            compatible.usage?.prompt_tokens ?? ollama.prompt_eval_count,
          );
      const outputTokens = numericTokenCount(
        (isAnthropic ? anthropic.usage?.output_tokens : undefined) ??
          compatible.usage?.completion_tokens ??
          ollama.eval_count,
      );
      const cacheInputTokens = isAnthropic
        ? numericTokenCount(anthropic.usage?.cache_creation_input_tokens) +
          numericTokenCount(anthropic.usage?.cache_read_input_tokens)
        : numericTokenCount(
            compatible.usage?.prompt_tokens_details?.cached_tokens,
          );
      const finishReason =
        reasonText(isAnthropic ? anthropic.stop_reason : undefined) ??
        reasonText(compatible.choices?.[0]?.finish_reason) ??
        reasonText(ollama.done_reason) ??
        '';
      const normalized =
        typeof content === 'string' ? normalizeText(content) : '';
      let status: 'success' | 'refused' | 'invalid_output' = 'success';
      let errorMessage: string | null = null;
      if (
        (isAnthropic && anthropic.stop_reason === 'refusal') ||
        compatible.choices?.[0]?.message?.refusal
      ) {
        status = 'refused';
        errorMessage = 'Provider AI từ chối đọc trang tài liệu';
      } else if (
        isAnthropic &&
        (anthropic.stop_reason === 'max_tokens' ||
          anthropic.stop_reason === 'model_context_window_exceeded')
      ) {
        status = 'invalid_output';
        errorMessage = 'Provider AI dừng khi chưa đọc xong trang tài liệu';
      } else if (normalized.length < 10) {
        status = 'invalid_output';
        errorMessage = 'Model AI không trích xuất được chữ từ trang tài liệu';
      }
      await this.usage.recordSafely({
        provider,
        ...usageContext,
        inputTokens,
        outputTokens,
        cacheInputTokens,
        status,
        latencyMs: Date.now() - startedAt,
        httpStatus: response.status,
        finishReason,
        errorCode: status === 'success' ? null : status.toUpperCase(),
        errorMessage,
      });
      usageRecorded = true;
      this.logger.log(
        `AI vision OCR used: provider=${provider.name} model=${provider.model} page=${pageNumber} status=${status} inputTokens=${inputTokens} outputTokens=${outputTokens} cacheInputTokens=${cacheInputTokens} latencyMs=${Date.now() - startedAt} referenceId=${usageContext.referenceId ?? 'none'}`,
      );
      if (errorMessage) throw new BadGatewayException(errorMessage);
      return {
        value: normalized.slice(0, 20_000),
        inputTokens,
        outputTokens,
      };
    } catch (error) {
      if (!usageRecorded) {
        const timeout = error instanceof Error && error.name === 'AbortError';
        await this.usage.recordSafely({
          provider,
          ...usageContext,
          inputTokens: 0,
          outputTokens: 0,
          status: timeout ? 'timeout' : 'failed',
          latencyMs: Date.now() - startedAt,
          errorCode: timeout ? 'TIMEOUT' : 'VISION_REQUEST_FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        error instanceof Error && error.name === 'AbortError'
          ? 'Provider AI đọc ảnh quá thời gian 120 giây'
          : `Không thể dùng AI đọc ảnh: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function compatibleRequestBody(
  provider: AiProviderEntity,
  system: string,
  prompt: string,
  outputSchema: AiJsonSchema,
): Record<string, unknown> {
  const hostname = new URL(provider.baseUrl).hostname.toLowerCase();
  const model = provider.model.toLowerCase();
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];
  const jsonSchema = {
    type: 'json_schema',
    json_schema: {
      name: 'zunibee_response',
      strict: true,
      schema: outputSchema,
    },
  };

  if (hostname === 'api.openai.com') {
    return { model: provider.model, messages, response_format: jsonSchema };
  }
  if (hostname === 'generativelanguage.googleapis.com') {
    return {
      model: provider.model,
      messages,
      ...(!model.startsWith('gemini-3') ? { temperature: 0.2 } : {}),
      response_format: jsonSchema,
    };
  }
  if (hostname === 'api.deepseek.com') {
    return {
      model: provider.model,
      messages,
      temperature: 0.2,
      max_tokens: 8_192,
      response_format: { type: 'json_object' },
    };
  }
  if (hostname === 'api.groq.com') {
    const supportsStrictSchema = model.startsWith('openai/gpt-oss-');
    return {
      model: provider.model,
      messages,
      temperature: 0.2,
      max_completion_tokens: 16_384,
      reasoning_format: 'hidden',
      response_format: supportsStrictSchema
        ? jsonSchema
        : { type: 'json_object' },
    };
  }
  if (hostname === 'openrouter.ai') {
    const shouldUseDefaultTemperature =
      model.startsWith('openai/gpt-5') || model.startsWith('google/gemini-3');
    return {
      model: provider.model,
      messages,
      ...(!shouldUseDefaultTemperature ? { temperature: 0.2 } : {}),
      response_format: jsonSchema,
      provider: { require_parameters: true },
    };
  }
  return {
    model: provider.model,
    messages,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  };
}

function isAnthropicApi(provider: AiProviderEntity): boolean {
  return (
    provider.kind === AiProviderKind.OPENAI_COMPATIBLE &&
    new URL(provider.baseUrl).hostname.toLowerCase() === 'api.anthropic.com'
  );
}

function isOpenRouter(provider: AiProviderEntity): boolean {
  return new URL(provider.baseUrl).hostname.toLowerCase() === 'openrouter.ai';
}

function extractCompatibleText(content: unknown): unknown {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content;
  return content
    .filter(
      (block): block is { type: string; text: string } =>
        Boolean(block) &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string',
    )
    .map((block) => block.text)
    .join('\n');
}

/** finish_reason/stop_reason từ provider chỉ đáng tin khi là string. */
function reasonText(value: unknown): string | null {
  return typeof value === 'string' && value ? value.slice(0, 100) : null;
}

function numericTokenCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
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
