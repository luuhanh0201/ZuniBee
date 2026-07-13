import { BadGatewayException, Injectable } from '@nestjs/common';
import {
  AiProviderKind,
  type AiProviderEntity,
} from './entities/ai-provider.entity';
import { AiProviderService } from './ai-provider.service';

export type AiCompletion = {
  value: unknown;
  inputTokens: number;
  outputTokens: number;
};

@Injectable()
export class AiModelClientService {
  constructor(private readonly providers: AiProviderService) {}
  async completeJson(
    provider: AiProviderEntity,
    system: string,
    prompt: string,
  ): Promise<AiCompletion> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const apiKey = this.providers.apiKey(provider);
      const response =
        provider.kind === AiProviderKind.OLLAMA
          ? await fetch(`${provider.baseUrl}/api/chat`, {
              method: 'POST',
              signal: controller.signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: provider.model,
                stream: false,
                format: 'json',
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: prompt },
                ],
                options: { temperature: 0.2 },
              }),
            })
          : await fetch(`${provider.baseUrl}/chat/completions`, {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
              },
              body: JSON.stringify({
                model: provider.model,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: prompt },
                ],
              }),
            });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new BadGatewayException(
          `Provider AI trả lỗi ${response.status}: ${detail || 'không có nội dung'}`,
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
      const content =
        provider.kind === AiProviderKind.OLLAMA
          ? ollama.message?.content
          : compatible.choices?.[0]?.message?.content;
      if (typeof content !== 'string')
        throw new BadGatewayException('Provider AI không trả nội dung hợp lệ');
      return {
        value: parseJsonContent(content),
        inputTokens: Number(
          compatible.usage?.prompt_tokens ?? ollama.prompt_eval_count ?? 0,
        ),
        outputTokens: Number(
          compatible.usage?.completion_tokens ?? ollama.eval_count ?? 0,
        ),
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
