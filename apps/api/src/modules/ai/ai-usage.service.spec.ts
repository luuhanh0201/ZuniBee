import type { Repository } from 'typeorm';
import { AiUsageService, calculateUsageCostUsd } from './ai-usage.service';
import { AiModelClientService } from './ai-model-client.service';
import { extractOpenRouterPricing } from './ai-provider.service';
import type { AiProviderService } from './ai-provider.service';
import type { AiProviderUrlPolicyService } from './ai-provider-url-policy.service';
import {
  AiProviderKind,
  type AiProviderEntity,
} from './entities/ai-provider.entity';
import type { AiUsageEventEntity } from './entities/ai-usage-event.entity';

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
};

function firstRequestBody(): Record<string, unknown> {
  const call = (global.fetch as jest.MockedFunction<typeof global.fetch>).mock
    .calls[0];
  const body = call?.[1]?.body;
  if (typeof body !== 'string') throw new Error('Request body phải là JSON');
  return JSON.parse(body) as Record<string, unknown>;
}

function provider(overrides: Partial<AiProviderEntity> = {}): AiProviderEntity {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'OpenRouter',
    kind: AiProviderKind.OPENAI_COMPATIBLE,
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3.5-flash',
    encryptedApiKey: null,
    isActive: true,
    isDefault: true,
    baseCreditCost: 1,
    creditCostPer1kTokens: 0,
    inputUsdPer1m: 0.3,
    outputUsdPer1m: 2.5,
    healthStatus: 'unknown',
    lastHealthLatencyMs: null,
    lastHealthCheckedAt: null,
    lastHealthError: null,
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    updatedAt: new Date('2026-07-14T00:00:00.000Z'),
    ...overrides,
  } as AiProviderEntity;
}

describe('calculateUsageCostUsd', () => {
  it('quy token ra USD theo đơn giá trên 1 triệu token', () => {
    expect(calculateUsageCostUsd(1_500, 2_000, 0.3, 2.5)).toBeCloseTo(
      0.00545,
      10,
    );
    expect(calculateUsageCostUsd(0, 0, 0.3, 2.5)).toBe(0);
    expect(calculateUsageCostUsd(1_000_000, 1_000_000, 0, 0)).toBe(0);
  });

  it('trả null khi thiếu giá ở bất kỳ chiều nào', () => {
    expect(calculateUsageCostUsd(1000, 1000, null, 2.5)).toBeNull();
    expect(calculateUsageCostUsd(1000, 1000, 0.3, null)).toBeNull();
    expect(calculateUsageCostUsd(1000, 1000, null, null)).toBeNull();
  });
});

describe('extractOpenRouterPricing', () => {
  it('đọc giá USD/token và quy về USD/1M token', () => {
    const payload = {
      data: [
        {
          id: 'google/gemini-3.5-flash',
          pricing: { prompt: '0.0000003', completion: '0.0000025' },
        },
      ],
    };
    expect(
      extractOpenRouterPricing(payload, 'google/gemini-3.5-flash'),
    ).toEqual({ inputUsdPer1m: 0.3, outputUsdPer1m: 2.5 });
  });

  it('trả null khi không có model hoặc giá không hợp lệ', () => {
    expect(extractOpenRouterPricing({ data: [] }, 'x')).toBeNull();
    expect(
      extractOpenRouterPricing(
        { data: [{ id: 'x', pricing: { prompt: 'abc', completion: '1' } }] },
        'x',
      ),
    ).toBeNull();
    expect(extractOpenRouterPricing(null, 'x')).toBeNull();
  });
});

describe('AiUsageService.record', () => {
  it('snapshot provider name/model/giá và tính costUsd', async () => {
    const saved: Partial<AiUsageEventEntity>[] = [];
    const repository = {
      create: (value: Partial<AiUsageEventEntity>) => value,
      save: (value: Partial<AiUsageEventEntity>) => {
        saved.push(value);
        return Promise.resolve(value);
      },
    } as unknown as Repository<AiUsageEventEntity>;
    const service = new AiUsageService(repository);

    await service.record({
      provider: provider(),
      source: 'quiz_generation',
      referenceId: '00000000-0000-4000-8000-000000000002',
      userId: '00000000-0000-4000-8000-000000000003',
      inputTokens: 1_500,
      outputTokens: 2_000,
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      providerName: 'OpenRouter',
      model: 'google/gemini-3.5-flash',
      source: 'quiz_generation',
      inputTokens: 1_500,
      outputTokens: 2_000,
      inputUsdPer1m: 0.3,
      outputUsdPer1m: 2.5,
    });
    expect(saved[0].costUsd).toBeCloseTo(0.00545, 10);
  });
});

describe('AiModelClientService + usage', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function buildClient(recordSafely: jest.Mock, apiKey: string | null = null) {
    return new AiModelClientService(
      { apiKey: () => apiKey } as unknown as AiProviderService,
      {
        assertAllowed: jest.fn().mockResolvedValue(undefined),
      } as unknown as AiProviderUrlPolicyService,
      { recordSafely } as unknown as AiUsageService,
    );
  }

  it('ghi usage event với token từ completion', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 120, completion_tokens: 45 },
        }),
    });
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const client = buildClient(recordSafely, 'openrouter-secret');

    const completion = await client.completeJson(
      provider(),
      'system',
      'prompt',
      { source: 'quiz_insight', referenceId: 'ref-1', userId: 'user-1' },
      OUTPUT_SCHEMA,
    );

    expect(completion.inputTokens).toBe(120);
    expect(completion.outputTokens).toBe(45);
    const fetchCall = (global.fetch as jest.MockedFunction<typeof global.fetch>)
      .mock.calls[0];
    expect(fetchCall?.[0]).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    );
    const headers = new Headers(fetchCall?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer openrouter-secret');
    expect(headers.get('x-api-key')).toBeNull();
    const request = firstRequestBody();
    expect(request).toMatchObject({
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'zunibee_response',
          strict: true,
          schema: OUTPUT_SCHEMA,
        },
      },
      provider: { require_parameters: true },
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'prompt' },
      ],
    });
    expect(request).not.toHaveProperty('temperature');
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'quiz_insight',
        referenceId: 'ref-1',
        userId: 'user-1',
        inputTokens: 120,
        outputTokens: 45,
      }),
    );
  });

  it('gọi Anthropic Messages API native với structured output', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: 'text', text: '{"ok":true}' }],
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 90,
            cache_creation_input_tokens: 10,
            cache_read_input_tokens: 5,
            output_tokens: 30,
          },
        }),
    });
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const client = buildClient(recordSafely, 'anthropic-secret');
    await expect(
      client.completeJson(
        provider({
          name: 'Anthropic Claude',
          baseUrl: 'https://api.anthropic.com/v1',
          model: 'claude-fable-5',
        }),
        'system',
        'prompt',
        { source: 'quiz_generation', referenceId: null, userId: null },
        OUTPUT_SCHEMA,
      ),
    ).resolves.toEqual({
      value: { ok: true },
      inputTokens: 105,
      outputTokens: 30,
    });

    const fetchCall = (global.fetch as jest.MockedFunction<typeof global.fetch>)
      .mock.calls[0];
    expect(fetchCall?.[0]).toBe('https://api.anthropic.com/v1/messages');
    const headers = new Headers(fetchCall?.[1]?.headers);
    expect(headers.get('x-api-key')).toBe('anthropic-secret');
    expect(headers.get('anthropic-version')).toBe('2023-06-01');
    expect(headers.get('Authorization')).toBeNull();
    const request = firstRequestBody();
    expect(request).toMatchObject({
      model: 'claude-fable-5',
      max_tokens: 16_384,
      system: 'system',
      messages: [{ role: 'user', content: 'prompt' }],
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    });
    expect(request).not.toHaveProperty('temperature');
    expect(request).not.toHaveProperty('response_format');
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 105, outputTokens: 30 }),
    );
  });

  it.each([
    {
      label: 'OpenAI GPT-5',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.4-mini',
      expected: {
        response_format: {
          type: 'json_schema',
          json_schema: { strict: true, schema: OUTPUT_SCHEMA },
        },
      },
    },
    {
      label: 'Gemini 3',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: 'gemini-3.5-flash',
      expected: { response_format: { type: 'json_schema' } },
    },
    {
      label: 'Gemini 2.5',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: 'gemini-2.5-flash',
      expected: {
        temperature: 0.2,
        response_format: { type: 'json_schema' },
      },
    },
    {
      label: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      expected: {
        temperature: 0.2,
        max_tokens: 8_192,
        response_format: { type: 'json_object' },
      },
    },
    {
      label: 'Groq Qwen',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'qwen/qwen3.6-27b',
      expected: {
        temperature: 0.2,
        max_completion_tokens: 16_384,
        reasoning_format: 'hidden',
        response_format: { type: 'json_object' },
      },
    },
    {
      label: 'Groq GPT OSS',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'openai/gpt-oss-120b',
      expected: {
        reasoning_format: 'hidden',
        response_format: { type: 'json_schema' },
      },
    },
  ])('tạo payload đúng cho $label', async ({ baseUrl, model, expected }) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
    });
    const client = buildClient(jest.fn().mockResolvedValue(undefined), 'key');

    await client.completeJson(
      provider({ baseUrl, model }),
      'system',
      'prompt',
      { source: 'quiz_generation', referenceId: null, userId: null },
      OUTPUT_SCHEMA,
    );

    expect(firstRequestBody()).toMatchObject(expected);
  });

  it('ghi usage rồi báo lỗi khi Anthropic từ chối nội dung', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: 'text', text: '{"refusal":"unsafe"}' }],
          stop_reason: 'refusal',
          usage: { input_tokens: 12, output_tokens: 3 },
        }),
    });
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const client = buildClient(recordSafely, 'anthropic-secret');

    await expect(
      client.completeJson(
        provider({
          baseUrl: 'https://api.anthropic.com/v1',
          model: 'claude-sonnet-5',
        }),
        'system',
        'prompt',
        { source: 'quiz_generation', referenceId: null, userId: null },
        OUTPUT_SCHEMA,
      ),
    ).rejects.toThrow('Provider AI từ chối yêu cầu');
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 12, outputTokens: 3 }),
    );
  });

  it('vẫn ghi usage khi provider trả JSON nghiệp vụ hỏng (token đã tiêu)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'không phải json' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
    });
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const client = buildClient(recordSafely);

    await expect(
      client.completeJson(
        provider(),
        'system',
        'prompt',
        {
          source: 'quiz_generation',
          referenceId: null,
          userId: null,
        },
        OUTPUT_SCHEMA,
      ),
    ).rejects.toThrow('Provider AI trả JSON không hợp lệ');
    expect(recordSafely).toHaveBeenCalledTimes(1);
  });
});

describe('AiUsageService.recordSafely', () => {
  it('không throw khi ghi event thất bại', async () => {
    const repository = {
      create: (value: unknown) => value,
      save: () => Promise.reject(new Error('db down')),
    } as unknown as Repository<AiUsageEventEntity>;
    const service = new AiUsageService(repository);

    await expect(
      service.recordSafely({
        provider: provider(),
        source: 'quiz_generation',
        referenceId: null,
        userId: null,
        inputTokens: 1,
        outputTokens: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
