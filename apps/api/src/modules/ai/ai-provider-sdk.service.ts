import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { Ollama } from 'ollama';
import OpenAI from 'openai';
import { providerDriverFor, AiProviderDriver } from './ai-provider-driver';
import type { AiProviderEntity } from './entities/ai-provider.entity';
import type {
  AiJsonSchema,
  AiStructuredOutputPlan,
} from './ai-structured-output.adapter';

export type AiSdkAttachment = {
  kind: 'image' | 'pdf';
  data: Buffer;
  mediaType: string;
};

export type AiSdkGenerateInput = {
  provider: AiProviderEntity;
  apiKey: string | null;
  system: string;
  prompt: string;
  plan: AiStructuredOutputPlan;
  attachment?: AiSdkAttachment;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  signal: AbortSignal;
};

/** Response đã chuẩn hóa, nhưng token/cost luôn là số SDK/provider trả về. */
export type AiSdkReply = {
  content: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheInputTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  providerCostUsd: number | null;
  providerRequestId: string | null;
  finishReason: string;
  refused: boolean;
  truncated: boolean;
  httpStatus: number;
};

export type AiSdkModel = {
  id: string;
  inputUsdPer1m: number | null;
  outputUsdPer1m: number | null;
};

export type AiSdkListModelsInput = {
  driver: AiProviderDriver;
  baseUrl: string;
  apiKey: string | null;
  timeoutMs: number;
  signal: AbortSignal;
};

export class AiProviderSdkError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null,
    readonly providerRequestId: string | null = null,
  ) {
    super(message);
    this.name = 'AiProviderSdkError';
  }
}

/**
 * Điểm duy nhất gọi SDK vendor. Không retry ở SDK: BullMQ mới là tầng retry
 * duy nhất để tránh một lỗi tạo nhiều request AI bị tính phí.
 */
@Injectable()
export class AiProviderSdkService {
  async generate(input: AiSdkGenerateInput): Promise<AiSdkReply> {
    try {
      switch (providerDriverFor(input.provider)) {
        case AiProviderDriver.ANTHROPIC:
          return await this.anthropic(input);
        case AiProviderDriver.GEMINI:
          return await this.gemini(input);
        case AiProviderDriver.OPENROUTER:
          return await this.openRouter(input);
        case AiProviderDriver.GROQ:
          return await this.groq(input);
        case AiProviderDriver.OLLAMA:
          return await this.ollama(input);
        case AiProviderDriver.OPENAI:
        case AiProviderDriver.DEEPSEEK:
        case AiProviderDriver.OPENAI_COMPATIBLE:
          return await this.openAiCompatible(input);
      }
    } catch (error) {
      if (error instanceof AiProviderSdkError) throw error;
      throw toSdkError(error);
    }
  }

  /** Danh sách model qua SDK vendor, chuẩn hóa ID và đơn giá nếu có. */
  async listModels(input: AiSdkListModelsInput): Promise<AiSdkModel[]> {
    try {
      switch (input.driver) {
        case AiProviderDriver.ANTHROPIC:
          return await this.listAnthropicModels(input);
        case AiProviderDriver.GEMINI:
          return await this.listGeminiModels(input);
        case AiProviderDriver.OPENROUTER:
          return await this.listOpenRouterModels(input);
        case AiProviderDriver.GROQ:
          return await this.listGroqModels(input);
        case AiProviderDriver.OLLAMA:
          return await this.listOllamaModels(input);
        case AiProviderDriver.OPENAI:
        case AiProviderDriver.DEEPSEEK:
        case AiProviderDriver.OPENAI_COMPATIBLE:
          return await this.listOpenAiModels(input);
      }
    } catch (error) {
      if (error instanceof AiProviderSdkError) throw error;
      throw toSdkError(error);
    }
  }

  private async openAiCompatible(
    input: AiSdkGenerateInput,
  ): Promise<AiSdkReply> {
    const client = new OpenAI({
      apiKey: input.apiKey ?? 'not-required',
      baseURL: input.provider.baseUrl,
      maxRetries: 0,
      timeout: input.timeoutMs,
    });
    const response = await client.chat.completions.create(
      openAiRequest(input) as never,
      { signal: input.signal },
    );
    return replyFromCompatible(response);
  }

  private async groq(input: AiSdkGenerateInput): Promise<AiSdkReply> {
    const client = new Groq({
      apiKey: input.apiKey ?? 'not-required',
      baseURL: input.provider.baseUrl,
      maxRetries: 0,
      timeout: input.timeoutMs,
    });
    const request = openAiRequest(input);
    delete request.max_tokens;
    const response = await client.chat.completions.create(
      {
        ...request,
        max_completion_tokens: input.maxOutputTokens,
        reasoning_format: 'hidden',
      } as never,
      { signal: input.signal },
    );
    return replyFromCompatible(response);
  }

  private async anthropic(input: AiSdkGenerateInput): Promise<AiSdkReply> {
    const client = new Anthropic({
      apiKey: input.apiKey ?? 'not-required',
      baseURL: input.provider.baseUrl,
      maxRetries: 0,
      timeout: input.timeoutMs,
    });
    const response = await client.messages.create(
      {
        model: input.provider.model,
        max_tokens: input.maxOutputTokens,
        system: input.system,
        messages: [
          {
            role: 'user',
            content: anthropicContent(input),
          },
        ],
        ...(input.plan.schema
          ? {
              output_config: {
                format: { type: 'json_schema', schema: input.plan.schema },
              },
            }
          : {}),
      } as never,
      { signal: input.signal },
    );
    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const usage = response.usage as {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    const cacheWriteTokens = numberValue(usage.cache_creation_input_tokens);
    const cacheReadTokens = numberValue(usage.cache_read_input_tokens);
    return {
      content: content || null,
      inputTokens:
        numberValue(usage.input_tokens) + cacheWriteTokens + cacheReadTokens,
      outputTokens: numberValue(usage.output_tokens),
      cacheInputTokens: cacheReadTokens,
      cacheWriteTokens,
      reasoningTokens: 0,
      providerCostUsd: null,
      providerRequestId: requestIdFromSdk(response),
      finishReason: response.stop_reason ?? '',
      refused: response.stop_reason === 'refusal',
      truncated: response.stop_reason === 'max_tokens',
      httpStatus: 200,
    };
  }

  private async gemini(input: AiSdkGenerateInput): Promise<AiSdkReply> {
    const endpoint = geminiEndpoint(input.provider.baseUrl);
    const client = new GoogleGenAI({
      apiKey: input.apiKey ?? 'not-required',
      httpOptions: {
        baseUrl: endpoint.origin,
        apiVersion: endpoint.apiVersion,
        timeout: input.timeoutMs,
        retryOptions: { attempts: 1 },
      },
    });
    const response = await client.models.generateContent({
      model: input.provider.model.replace(/^models\//, ''),
      contents: [
        {
          role: 'user',
          parts: geminiParts(input),
        },
      ],
      config: {
        systemInstruction: input.system,
        maxOutputTokens: input.maxOutputTokens,
        responseMimeType: input.plan.schema ? 'application/json' : undefined,
        ...(input.plan.schema ? { responseJsonSchema: input.plan.schema } : {}),
        ...(!input.provider.model.toLowerCase().startsWith('gemini-3')
          ? { temperature: input.temperature }
          : {}),
        abortSignal: input.signal,
      },
    });
    const candidate = response.candidates?.[0];
    const finishReason = stringValue(candidate?.finishReason);
    const usage = response.usageMetadata;
    return {
      content: response.text ?? null,
      inputTokens: numberValue(usage?.promptTokenCount),
      outputTokens: numberValue(usage?.candidatesTokenCount),
      cacheInputTokens: numberValue(usage?.cachedContentTokenCount),
      cacheWriteTokens: 0,
      reasoningTokens: numberValue(usage?.thoughtsTokenCount),
      providerCostUsd: null,
      providerRequestId: response.responseId ?? null,
      finishReason,
      refused: Boolean(
        response.promptFeedback?.blockReason ||
        [
          'SAFETY',
          'RECITATION',
          'BLOCKLIST',
          'PROHIBITED_CONTENT',
          'SPII',
        ].includes(finishReason),
      ),
      truncated: finishReason === 'MAX_TOKENS',
      httpStatus: 200,
    };
  }

  private async openRouter(input: AiSdkGenerateInput): Promise<AiSdkReply> {
    // @openrouter/sdk chỉ ESM; dynamic import giữ Nest CommonJS runtime tương thích.
    const { OpenRouter } = await import('@openrouter/sdk');
    const client = new OpenRouter({
      apiKey: input.apiKey ?? 'not-required',
      serverURL: input.provider.baseUrl,
      timeoutMs: input.timeoutMs,
      retryConfig: { strategy: 'none' },
    });
    const result = (await client.chat.send(
      {
        chatRequest: {
          model: input.provider.model,
          messages: openRouterMessages(input),
          temperature: input.temperature,
          maxCompletionTokens: input.maxOutputTokens,
          responseFormat: openRouterResponseFormat(input.plan),
          provider: { requireParameters: true },
        } as never,
      },
      { signal: input.signal, retries: { strategy: 'none' } },
    )) as {
      id?: string;
      choices?: Array<{
        message?: { content?: unknown; refusal?: string | null };
        finishReason?: string | null;
      }>;
      usage?: {
        promptTokens?: number;
        completionTokens?: number;
        cost?: number | null;
        promptTokensDetails?: {
          cachedTokens?: number;
          cacheWriteTokens?: number;
        };
        completionTokensDetails?: { reasoningTokens?: number };
      };
    };
    const choice = result.choices?.[0];
    const finishReason = stringValue(choice?.finishReason);
    return {
      content: textContent(choice?.message?.content),
      inputTokens: numberValue(result.usage?.promptTokens),
      outputTokens: numberValue(result.usage?.completionTokens),
      cacheInputTokens: numberValue(
        result.usage?.promptTokensDetails?.cachedTokens,
      ),
      cacheWriteTokens: numberValue(
        result.usage?.promptTokensDetails?.cacheWriteTokens,
      ),
      reasoningTokens: numberValue(
        result.usage?.completionTokensDetails?.reasoningTokens,
      ),
      providerCostUsd: finiteCost(result.usage?.cost),
      providerRequestId: result.id ?? null,
      finishReason,
      refused: Boolean(choice?.message?.refusal),
      truncated: finishReason === 'length',
      httpStatus: 200,
    };
  }

  private async ollama(input: AiSdkGenerateInput): Promise<AiSdkReply> {
    const client = new Ollama({ host: input.provider.baseUrl });
    const abort = () => client.abort();
    input.signal.addEventListener('abort', abort, { once: true });
    let response;
    try {
      response = await client.chat({
        model: input.provider.model,
        stream: false,
        format: input.plan.schema ?? undefined,
        messages: [
          { role: 'system', content: input.system },
          {
            role: 'user',
            content: input.prompt,
            ...(input.attachment?.kind === 'image'
              ? { images: [input.attachment.data] }
              : {}),
          },
        ],
        options: {
          temperature: input.temperature,
          num_predict: input.maxOutputTokens,
        },
      });
    } finally {
      input.signal.removeEventListener('abort', abort);
    }
    return {
      content: response.message?.content ?? null,
      inputTokens: numberValue(response.prompt_eval_count),
      outputTokens: numberValue(response.eval_count),
      cacheInputTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      providerCostUsd: null,
      providerRequestId: null,
      finishReason: response.done_reason ?? '',
      refused: false,
      truncated: response.done_reason === 'length',
      httpStatus: 200,
    };
  }

  private async listOpenAiModels(
    input: AiSdkListModelsInput,
  ): Promise<AiSdkModel[]> {
    const client = new OpenAI({
      apiKey: input.apiKey ?? 'not-required',
      baseURL: input.baseUrl,
      maxRetries: 0,
      timeout: input.timeoutMs,
    });
    const response = await client.models.list({ signal: input.signal });
    return modelsFromSdk(response.data);
  }

  private async listGroqModels(
    input: AiSdkListModelsInput,
  ): Promise<AiSdkModel[]> {
    const client = new Groq({
      apiKey: input.apiKey ?? 'not-required',
      baseURL: input.baseUrl,
      maxRetries: 0,
      timeout: input.timeoutMs,
    });
    const response = await client.models.list({ signal: input.signal });
    return modelsFromSdk(response.data);
  }

  private async listAnthropicModels(
    input: AiSdkListModelsInput,
  ): Promise<AiSdkModel[]> {
    const client = new Anthropic({
      apiKey: input.apiKey ?? 'not-required',
      baseURL: input.baseUrl,
      maxRetries: 0,
      timeout: input.timeoutMs,
    });
    const response = await client.models.list({ limit: 1000 } as never, {
      signal: input.signal,
    });
    return modelsFromSdk((response as { data?: unknown[] }).data ?? []);
  }

  private async listGeminiModels(
    input: AiSdkListModelsInput,
  ): Promise<AiSdkModel[]> {
    const endpoint = geminiEndpoint(input.baseUrl);
    const client = new GoogleGenAI({
      apiKey: input.apiKey ?? 'not-required',
      httpOptions: {
        baseUrl: endpoint.origin,
        apiVersion: endpoint.apiVersion,
        timeout: input.timeoutMs,
        retryOptions: { attempts: 1 },
      },
    });
    const pager = await client.models.list({ config: { pageSize: 500 } });
    return modelsFromSdk(pager.page);
  }

  private async listOpenRouterModels(
    input: AiSdkListModelsInput,
  ): Promise<AiSdkModel[]> {
    const { OpenRouter } = await import('@openrouter/sdk');
    const client = new OpenRouter({
      apiKey: input.apiKey ?? 'not-required',
      serverURL: input.baseUrl,
      timeoutMs: input.timeoutMs,
      retryConfig: { strategy: 'none' },
    });
    const response = await client.models.list(
      { limit: 500 },
      { signal: input.signal, retries: { strategy: 'none' } },
    );
    return modelsFromSdk(response.result.data);
  }

  private async listOllamaModels(
    input: AiSdkListModelsInput,
  ): Promise<AiSdkModel[]> {
    const client = new Ollama({ host: input.baseUrl });
    const abort = () => client.abort();
    input.signal.addEventListener('abort', abort, { once: true });
    let response;
    try {
      response = await client.list();
    } finally {
      input.signal.removeEventListener('abort', abort);
    }
    return modelsFromSdk(response.models);
  }
}

function openAiRequest(input: AiSdkGenerateInput): Record<string, unknown> {
  const content = openAiContent(input);
  const driver = providerDriverFor(input.provider);
  return {
    model: input.provider.model,
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content },
    ],
    ...(driver === AiProviderDriver.OPENAI
      ? { max_completion_tokens: input.maxOutputTokens }
      : {
          temperature: input.temperature,
          max_tokens:
            driver === AiProviderDriver.DEEPSEEK
              ? Math.min(input.maxOutputTokens, 8_192)
              : input.maxOutputTokens,
        }),
    ...openAiResponseFormat(input.plan),
  };
}

function openAiContent(input: AiSdkGenerateInput): unknown {
  if (!input.attachment) return input.prompt;
  if (input.attachment.kind === 'image')
    return [
      { type: 'text', text: input.prompt },
      {
        type: 'image_url',
        image_url: {
          url: `data:${input.attachment.mediaType};base64,${input.attachment.data.toString('base64')}`,
          detail: 'high',
        },
      },
    ];
  return [
    {
      type: 'file',
      file: {
        filename: 'pages.pdf',
        file_data: `data:${input.attachment.mediaType};base64,${input.attachment.data.toString('base64')}`,
      },
    },
    { type: 'text', text: input.prompt },
  ];
}

function anthropicContent(input: AiSdkGenerateInput): unknown {
  if (!input.attachment) return input.prompt;
  const data = input.attachment.data.toString('base64');
  return input.attachment.kind === 'image'
    ? [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: input.attachment.mediaType,
            data,
          },
        },
        { type: 'text', text: input.prompt },
      ]
    : [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: input.attachment.mediaType,
            data,
          },
        },
        { type: 'text', text: input.prompt },
      ];
}

function geminiParts(
  input: AiSdkGenerateInput,
): Array<Record<string, unknown>> {
  if (!input.attachment) return [{ text: input.prompt }];
  return [
    {
      inlineData: {
        mimeType: input.attachment.mediaType,
        data: input.attachment.data.toString('base64'),
      },
    },
    { text: input.prompt },
  ];
}

function openRouterMessages(
  input: AiSdkGenerateInput,
): Array<Record<string, unknown>> {
  return [
    { role: 'system', content: input.system },
    { role: 'user', content: openAiContent(input) },
  ];
}

function openAiResponseFormat(
  plan: AiStructuredOutputPlan,
): Record<string, unknown> {
  if (plan.mode === 'strict_schema' && plan.schema)
    return {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'zunibee_response',
          strict: true,
          schema: plan.schema,
        },
      },
    };
  return plan.mode === 'json_object'
    ? { response_format: { type: 'json_object' } }
    : {};
}

function openRouterResponseFormat(plan: AiStructuredOutputPlan): unknown {
  if (plan.mode === 'strict_schema' && plan.schema)
    return {
      type: 'json_schema',
      jsonSchema: {
        name: 'zunibee_response',
        strict: true,
        schema: plan.schema,
      },
    };
  return plan.mode === 'json_object' ? { type: 'json_object' } : undefined;
}

function replyFromCompatible(response: unknown): AiSdkReply {
  const value = response as {
    id?: string;
    _request_id?: string;
    choices?: Array<{
      message?: { content?: unknown; refusal?: unknown };
      finish_reason?: unknown;
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  const choice = value.choices?.[0];
  const finishReason = stringValue(choice?.finish_reason);
  return {
    content: textContent(choice?.message?.content),
    inputTokens: numberValue(value.usage?.prompt_tokens),
    outputTokens: numberValue(value.usage?.completion_tokens),
    cacheInputTokens: numberValue(
      value.usage?.prompt_tokens_details?.cached_tokens,
    ),
    cacheWriteTokens: 0,
    reasoningTokens: numberValue(
      value.usage?.completion_tokens_details?.reasoning_tokens,
    ),
    providerCostUsd: null,
    providerRequestId: value._request_id ?? value.id ?? null,
    finishReason,
    refused: Boolean(choice?.message?.refusal),
    truncated: finishReason === 'length' || finishReason === 'max_tokens',
    httpStatus: 200,
  };
}

function geminiEndpoint(baseUrl: string): {
  origin: string;
  apiVersion: string;
} {
  const url = new URL(baseUrl);
  const version = url.pathname.split('/').find((part) => /^v\d/.test(part));
  return { origin: url.origin, apiVersion: version ?? 'v1beta' };
}

function toSdkError(error: unknown): AiProviderSdkError {
  const record = error as {
    message?: unknown;
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown; headers?: Headers };
    headers?: Headers;
    requestID?: unknown;
    request_id?: unknown;
  };
  const status = numericStatus(
    record.status ?? record.statusCode ?? record.response?.status,
  );
  const requestId =
    stringValue(record.requestID) ||
    stringValue(record.request_id) ||
    record.response?.headers?.get('x-request-id') ||
    record.headers?.get('x-request-id') ||
    null;
  return new AiProviderSdkError(
    stringValue(record.message) || 'Provider SDK không trả phản hồi hợp lệ',
    status,
    requestId,
  );
}

function requestIdFromSdk(value: unknown): string | null {
  const record = value as { _request_id?: unknown; request_id?: unknown };
  return (
    stringValue(record._request_id) || stringValue(record.request_id) || null
  );
}

function textContent(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  if (!Array.isArray(value)) return null;
  const content = value
    .filter(
      (item): item is { type?: unknown; text?: unknown } =>
        Boolean(item) && typeof item === 'object',
    )
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text as string)
    .join('\n');
  return content || null;
}

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function finiteCost(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function modelsFromSdk(items: unknown[]): AiSdkModel[] {
  const byId = new Map<string, AiSdkModel>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as {
      id?: unknown;
      name?: unknown;
      model?: unknown;
      pricing?: { prompt?: unknown; completion?: unknown };
    };
    const rawId = record.id ?? record.name ?? record.model;
    if (typeof rawId !== 'string') continue;
    const id = rawId.trim().replace(/^models\//, '');
    if (!id || id.length > 200) continue;
    const inputPrice = finiteCost(record.pricing?.prompt);
    const outputPrice = finiteCost(record.pricing?.completion);
    byId.set(id, {
      id,
      inputUsdPer1m:
        inputPrice === null ? null : roundUsdPer1m(inputPrice * 1_000_000),
      outputUsdPer1m:
        outputPrice === null ? null : roundUsdPer1m(outputPrice * 1_000_000),
    });
  }
  return [...byId.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function roundUsdPer1m(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function numericStatus(value: unknown): number | null {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 250) : '';
}
