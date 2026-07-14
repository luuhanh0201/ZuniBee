import { BadGatewayException, Injectable } from '@nestjs/common';
import type { AiUsageSource } from '@zunibee/shared';
import {
  AiProviderKind,
  type AiProviderEntity,
} from './entities/ai-provider.entity';
import { AiProviderService } from './ai-provider.service';
import { AiProviderUrlPolicyService } from './ai-provider-url-policy.service';
import { AiUsageService } from './ai-usage.service';

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
        throw new BadGatewayException(
          `Provider AI trả lỗi HTTP ${response.status}`,
        );
      }
      const body = (await response.json()) as unknown;
      const ollama = body as {
        message?: { content?: unknown };
        prompt_eval_count?: unknown;
        eval_count?: unknown;
      };
      const compatible = body as {
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
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
      // Ghi usage trước khi validate nội dung: token đã bị tiêu kể cả khi
      // provider trả JSON hỏng.
      await this.usage.recordSafely({
        provider,
        source: usageContext.source,
        referenceId: usageContext.referenceId,
        userId: usageContext.userId,
        inputTokens,
        outputTokens,
      });
      if (isAnthropic && anthropic.stop_reason === 'refusal')
        throw new BadGatewayException('Provider AI từ chối yêu cầu');
      if (
        isAnthropic &&
        (anthropic.stop_reason === 'max_tokens' ||
          anthropic.stop_reason === 'model_context_window_exceeded')
      )
        throw new BadGatewayException(
          'Provider AI dừng vì vượt giới hạn output token',
        );
      if (typeof content !== 'string')
        throw new BadGatewayException('Provider AI không trả nội dung hợp lệ');
      return {
        value: parseJsonContent(content),
        inputTokens,
        outputTokens,
      };
    } catch (error) {
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

function numericTokenCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
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
