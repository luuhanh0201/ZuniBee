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
  AiRequestError,
  categoryFromProviderFailure,
  isRetryableHttpStatus,
  providerErrorMessage,
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
};

export type { AiJsonSchema } from './ai-structured-output.adapter';

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
      const plan = resolveStructuredOutput(provider, outputSchema);
      const effectivePrompt = plan.promptInstruction
        ? `${prompt}${plan.promptInstruction}`
        : prompt;
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
                ...(plan.schema ? { format: plan.schema } : {}),
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: effectivePrompt },
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
                  messages: [{ role: 'user', content: effectivePrompt }],
                  ...(plan.schema
                    ? {
                        output_config: {
                          format: {
                            type: 'json_schema',
                            schema: plan.schema,
                          },
                        },
                      }
                    : {}),
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
                      effectivePrompt,
                      plan,
                    ),
                  ),
                },
              );
      if (!response.ok) {
        throw await this.failFromResponse({
          response,
          provider,
          apiKey,
          usageContext,
          startedAt,
          structuredOutputMode: plan.mode,
          markUsageRecorded: () => {
            usageRecorded = true;
          },
        });
      }
      const reply = parseProviderReply(await response.json(), provider);
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
        ...usageContext,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        cacheInputTokens: reply.cacheInputTokens,
        status,
        latencyMs: Date.now() - startedAt,
        httpStatus: response.status,
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
          statusCode: response.status,
        });
      }
      return {
        value,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
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
          errorCode: timeout ? 'provider_timeout' : 'request_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      if (error instanceof BadGatewayException) throw error;
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
      clearTimeout(timer);
    }
  }

  /**
   * Đọc body lỗi của provider TRƯỚC khi bỏ response để không mất nguyên nhân
   * thật (trước đây chỉ còn "HTTP 400"), sanitize rồi ghi usage + log và trả
   * về AiRequestError đã phân loại retry được hay không.
   */
  private async failFromResponse(args: {
    response: Response;
    provider: AiProviderEntity;
    apiKey: string | null;
    usageContext: AiUsageContext;
    startedAt: number;
    structuredOutputMode: AiStructuredOutputPlan['mode'] | null;
    messagePrefix?: string;
    markUsageRecorded: () => void;
  }): Promise<AiRequestError> {
    const { response, provider } = args;
    const rawBody = await response.text().catch(() => '');
    const detail = sanitizeProviderMessage(
      providerErrorMessage(rawBody),
      args.apiKey,
    );
    const category = categoryFromProviderFailure(response.status, detail);
    const prefix = args.messagePrefix ?? 'Provider AI trả lỗi';
    const message = detail
      ? `${prefix} (HTTP ${response.status}): ${detail}`
      : `${prefix} (HTTP ${response.status})`;
    await this.usage.recordSafely({
      provider,
      ...args.usageContext,
      inputTokens: 0,
      outputTokens: 0,
      status: 'failed',
      latencyMs: Date.now() - args.startedAt,
      httpStatus: response.status,
      errorCode: category,
      errorMessage: message,
    });
    args.markUsageRecorded();
    this.logger.warn(
      `AI provider request failed: provider=${provider.name} model=${provider.model} status=${response.status} category=${category} mode=${args.structuredOutputMode ?? 'none'} referenceId=${args.usageContext.referenceId ?? 'none'} message=${detail || 'không có body lỗi'}`,
    );
    return new AiRequestError(message, {
      category,
      retryable: isRetryableHttpStatus(response.status),
      provider: provider.name,
      model: provider.model,
      statusCode: response.status,
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
        throw await this.failFromResponse({
          response,
          provider,
          apiKey,
          usageContext,
          startedAt,
          structuredOutputMode: null,
          messagePrefix: 'Model AI không đọc được hình ảnh',
          markUsageRecorded: () => {
            usageRecorded = true;
          },
        });
      }

      const reply = parseProviderReply(await response.json(), provider);
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
        ...usageContext,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        cacheInputTokens: reply.cacheInputTokens,
        status,
        latencyMs: Date.now() - startedAt,
        httpStatus: response.status,
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
          statusCode: response.status,
        });
      return {
        value: normalized.slice(0, 20_000),
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
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
          errorCode: timeout ? 'provider_timeout' : 'request_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      if (error instanceof BadGatewayException) throw error;
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
      clearTimeout(timer);
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    const startedAt = Date.now();
    let usageRecorded = false;
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
      const apiKey = this.providers.apiKey(provider);
      const isAnthropic = isAnthropicApi(provider);
      const isGemini = isGeminiApi(provider);
      const schema = pdfPagesOutputSchema(pageNumbers);
      const plan = resolveStructuredOutput(provider, schema);
      const system = pdfPagesSystemPrompt();
      const prompt = plan.promptInstruction
        ? `${pdfPagesUserPrompt(pageNumbers)}${plan.promptInstruction}`
        : pdfPagesUserPrompt(pageNumbers);
      const base64 = pdf.toString('base64');
      const response = isAnthropic
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
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'document',
                      source: {
                        type: 'base64',
                        media_type: 'application/pdf',
                        data: base64,
                      },
                    },
                    { type: 'text', text: prompt },
                  ],
                },
              ],
              ...(plan.schema
                ? {
                    output_config: {
                      format: { type: 'json_schema', schema: plan.schema },
                    },
                  }
                : {}),
            }),
          })
        : isGemini
          ? await fetch(geminiGenerateContentUrl(provider), {
              method: 'POST',
              redirect: 'error',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'x-goog-api-key': apiKey } : {}),
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [
                  {
                    role: 'user',
                    parts: [
                      {
                        inlineData: {
                          mimeType: 'application/pdf',
                          data: base64,
                        },
                      },
                      { text: prompt },
                    ],
                  },
                ],
                generationConfig: {
                  maxOutputTokens: 16_384,
                  responseMimeType: 'application/json',
                  ...(plan.schema ? { responseJsonSchema: plan.schema } : {}),
                  ...(!provider.model.toLowerCase().startsWith('gemini-3')
                    ? { temperature: 0.2 }
                    : {}),
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
                body: JSON.stringify({
                  model: provider.model,
                  messages: [
                    { role: 'system', content: system },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'file',
                          file: {
                            filename: 'pages.pdf',
                            file_data: `data:application/pdf;base64,${base64}`,
                          },
                        },
                        { type: 'text', text: prompt },
                      ],
                    },
                  ],
                  ...(plan.mode === 'strict_schema'
                    ? {
                        response_format: {
                          type: 'json_schema',
                          json_schema: {
                            name: 'zunibee_pdf_pages',
                            strict: true,
                            schema: plan.schema,
                          },
                        },
                      }
                    : { response_format: { type: 'json_object' } }),
                  ...(isOpenRouter(provider)
                    ? { provider: { require_parameters: true } }
                    : {}),
                }),
              },
            );
      if (!response.ok) {
        throw await this.failFromResponse({
          response,
          provider,
          apiKey,
          usageContext,
          startedAt,
          structuredOutputMode: plan.mode,
          messagePrefix: 'Model AI không đọc được PDF',
          markUsageRecorded: () => {
            usageRecorded = true;
          },
        });
      }
      const responseBody: unknown = await response.json();
      const reply = isGemini
        ? parseGeminiProviderReply(responseBody)
        : parseProviderReply(responseBody, provider);
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
        ...usageContext,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        cacheInputTokens: reply.cacheInputTokens,
        status,
        latencyMs: Date.now() - startedAt,
        httpStatus: response.status,
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
            statusCode: response.status,
          },
        );
      return {
        pages,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
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
          errorCode: timeout ? 'provider_timeout' : 'request_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      if (error instanceof AiRequestError) throw error;
      if (error instanceof BadGatewayException) throw error;
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
      clearTimeout(timer);
    }
  }
}

type ProviderReply = {
  content: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheInputTokens: number;
  finishReason: string;
  refused: boolean;
  truncated: boolean;
};

/**
 * Chuẩn hóa response của Ollama, Anthropic và OpenAI-compatible tại một chỗ
 * để các luồng JSON, ảnh và PDF dùng cùng cách tính token/refusal/truncation.
 */
function parseProviderReply(
  body: unknown,
  provider: AiProviderEntity,
): ProviderReply {
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
  const anthropicApi = isAnthropicApi(provider);
  const rawContent =
    provider.kind === AiProviderKind.OLLAMA
      ? ollama.message?.content
      : anthropicApi
        ? anthropic.content
            ?.filter(
              (block) =>
                block.type === 'text' && typeof block.text === 'string',
            )
            .map((block) => block.text)
            .join('\n')
        : extractCompatibleText(compatible.choices?.[0]?.message?.content);
  const finishReason =
    reasonText(anthropicApi ? anthropic.stop_reason : undefined) ??
    reasonText(compatible.choices?.[0]?.finish_reason) ??
    reasonText(ollama.done_reason) ??
    '';
  return {
    content: typeof rawContent === 'string' ? rawContent : null,
    inputTokens: anthropicApi
      ? numericTokenCount(anthropic.usage?.input_tokens) +
        numericTokenCount(anthropic.usage?.cache_creation_input_tokens) +
        numericTokenCount(anthropic.usage?.cache_read_input_tokens)
      : numericTokenCount(
          compatible.usage?.prompt_tokens ?? ollama.prompt_eval_count,
        ),
    outputTokens: numericTokenCount(
      (anthropicApi ? anthropic.usage?.output_tokens : undefined) ??
        compatible.usage?.completion_tokens ??
        ollama.eval_count,
    ),
    cacheInputTokens: anthropicApi
      ? numericTokenCount(anthropic.usage?.cache_creation_input_tokens) +
        numericTokenCount(anthropic.usage?.cache_read_input_tokens)
      : numericTokenCount(
          compatible.usage?.prompt_tokens_details?.cached_tokens,
        ),
    refused: Boolean(
      (anthropicApi && anthropic.stop_reason === 'refusal') ||
      compatible.choices?.[0]?.message?.refusal,
    ),
    truncated:
      finishReason === 'max_tokens' ||
      finishReason === 'model_context_window_exceeded' ||
      finishReason === 'length',
    finishReason,
  };
}

/** Chuẩn hóa generateContent response về cùng shape với OpenAI/Anthropic. */
function parseGeminiProviderReply(body: unknown): ProviderReply {
  const response = body as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: unknown }> };
      finishReason?: unknown;
    }>;
    promptFeedback?: { blockReason?: unknown };
    usageMetadata?: {
      promptTokenCount?: unknown;
      candidatesTokenCount?: unknown;
      cachedContentTokenCount?: unknown;
    };
  };
  const candidate = response.candidates?.[0];
  const finishReason = reasonText(candidate?.finishReason) ?? '';
  const content = candidate?.content?.parts
    ?.filter((part) => typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
  const blockReason = reasonText(response.promptFeedback?.blockReason);
  return {
    content: typeof content === 'string' && content ? content : null,
    inputTokens: numericTokenCount(response.usageMetadata?.promptTokenCount),
    outputTokens: numericTokenCount(
      response.usageMetadata?.candidatesTokenCount,
    ),
    cacheInputTokens: numericTokenCount(
      response.usageMetadata?.cachedContentTokenCount,
    ),
    finishReason: blockReason ?? finishReason,
    refused: Boolean(
      blockReason ||
      [
        'SAFETY',
        'RECITATION',
        'BLOCKLIST',
        'PROHIBITED_CONTENT',
        'SPII',
      ].includes(finishReason),
    ),
    truncated: finishReason === 'MAX_TOKENS',
  };
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

function compatibleRequestBody(
  provider: AiProviderEntity,
  system: string,
  prompt: string,
  plan: AiStructuredOutputPlan,
): Record<string, unknown> {
  const hostname = new URL(provider.baseUrl).hostname.toLowerCase();
  const model = provider.model.toLowerCase();
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];
  // Chế độ structured output do adapter quyết định theo provider/model;
  // hàm này chỉ giữ các quirk còn lại (temperature, max_tokens...).
  const responseFormat =
    plan.mode === 'strict_schema'
      ? {
          type: 'json_schema',
          json_schema: {
            name: 'zunibee_response',
            strict: true,
            schema: plan.schema,
          },
        }
      : plan.mode === 'json_object'
        ? { type: 'json_object' }
        : null;
  const responseFormatField = responseFormat
    ? { response_format: responseFormat }
    : {};

  if (hostname === 'api.openai.com') {
    return { model: provider.model, messages, ...responseFormatField };
  }
  if (hostname === 'generativelanguage.googleapis.com') {
    return {
      model: provider.model,
      messages,
      ...(!model.startsWith('gemini-3') ? { temperature: 0.2 } : {}),
      ...responseFormatField,
    };
  }
  if (hostname === 'api.deepseek.com') {
    return {
      model: provider.model,
      messages,
      temperature: 0.2,
      max_tokens: 8_192,
      ...responseFormatField,
    };
  }
  if (hostname === 'api.groq.com') {
    return {
      model: provider.model,
      messages,
      temperature: 0.2,
      max_completion_tokens: 16_384,
      reasoning_format: 'hidden',
      ...responseFormatField,
    };
  }
  if (hostname === 'openrouter.ai') {
    const shouldUseDefaultTemperature =
      model.startsWith('openai/gpt-5') || model.startsWith('google/gemini-3');
    return {
      model: provider.model,
      messages,
      ...(!shouldUseDefaultTemperature ? { temperature: 0.2 } : {}),
      ...responseFormatField,
      provider: { require_parameters: true },
    };
  }
  return {
    model: provider.model,
    messages,
    temperature: 0.2,
    ...responseFormatField,
  };
}

function isAnthropicApi(provider: AiProviderEntity): boolean {
  return (
    provider.kind === AiProviderKind.OPENAI_COMPATIBLE &&
    new URL(provider.baseUrl).hostname.toLowerCase() === 'api.anthropic.com'
  );
}

function isGeminiApi(provider: AiProviderEntity): boolean {
  return (
    provider.kind === AiProviderKind.OPENAI_COMPATIBLE &&
    new URL(provider.baseUrl).hostname.toLowerCase() ===
      'generativelanguage.googleapis.com'
  );
}

function geminiGenerateContentUrl(provider: AiProviderEntity): string {
  const url = new URL(provider.baseUrl);
  url.pathname = url.pathname.replace(/\/openai\/?$/, '').replace(/\/$/, '');
  const model = provider.model.replace(/^models\//, '');
  url.pathname = `${url.pathname}/models/${encodeURIComponent(model)}:generateContent`;
  url.search = '';
  url.hash = '';
  return url.toString();
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
