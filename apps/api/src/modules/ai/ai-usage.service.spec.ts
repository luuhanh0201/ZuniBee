import type { Repository } from 'typeorm';
import { AiUsageService, calculateUsageCostUsd } from './ai-usage.service';
import {
  AiModelClientService,
  parsePdfPagesReply,
} from './ai-model-client.service';
import { extractOpenRouterPricing } from './ai-provider.service';
import type { AiProviderService } from './ai-provider.service';
import type { AiProviderUrlPolicyService } from './ai-provider-url-policy.service';
import {
  AiProviderKind,
  type AiProviderEntity,
} from './entities/ai-provider.entity';
import type { AiUsageEventEntity } from './entities/ai-usage-event.entity';
import type { AiUsageBudgetEntity } from './entities/ai-usage-budget.entity';
import type { AiBudgetNotificationService } from '@/modules/notification/ai-budget-notification.service';

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
    isVisionDefault: true,
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

  it('queues a budget alert after paid usage reaches the warning threshold', async () => {
    const usageQuery = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ spent: '0.80' }),
    };
    const repository = {
      create: (value: Partial<AiUsageEventEntity>) => value,
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => usageQuery),
    } as unknown as Repository<AiUsageEventEntity>;
    const budget = {
      id: '00000000-0000-4000-8000-000000000011',
      name: 'Ngân sách AI tháng',
      scope: 'global',
      scopeValue: null,
      period: 'monthly',
      limitUsd: 1,
      warningPercent: 80,
      isActive: true,
      createdBy: '00000000-0000-4000-8000-000000000012',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    } as AiUsageBudgetEntity;
    const budgets = {
      find: jest.fn().mockResolvedValue([budget]),
    } as unknown as Repository<AiUsageBudgetEntity>;
    const enqueueBudgetAlert = jest.fn().mockResolvedValue(1);
    const notifications = {
      enqueue: enqueueBudgetAlert,
    } as unknown as AiBudgetNotificationService;
    const service = new AiUsageService(repository, budgets, notifications);

    await service.record({
      provider: provider({ inputUsdPer1m: 1, outputUsdPer1m: 1 }),
      source: 'quiz_generation',
      referenceId: null,
      userId: null,
      inputTokens: 1,
      outputTokens: 1,
    });

    expect(enqueueBudgetAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetId: budget.id,
        budgetName: budget.name,
        spentUsd: 0.8,
        limitUsd: 1,
        warningPercent: 80,
      }),
    );
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

  it('gửi ảnh qua OpenAI-compatible và ghi usage nguồn AI OCR', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Nội dung nhìn thấy trên trang.' } }],
          usage: { prompt_tokens: 240, completion_tokens: 18 },
        }),
    });
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const client = buildClient(recordSafely, 'openrouter-secret');

    await expect(
      client.readImageText(
        provider(),
        Buffer.from('fake-png'),
        'image/png',
        {
          source: 'document_vision_ocr',
          referenceId: '00000000-0000-4000-8000-000000000009',
          userId: '00000000-0000-4000-8000-000000000010',
        },
        3,
      ),
    ).resolves.toMatchObject({
      value: 'Nội dung nhìn thấy trên trang.',
      inputTokens: 240,
      outputTokens: 18,
    });
    expect(firstRequestBody()).toMatchObject({
      messages: [
        { role: 'system' },
        {
          role: 'user',
          content: [
            { type: 'text' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${Buffer.from('fake-png').toString('base64')}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      provider: { require_parameters: true },
    });
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'document_vision_ocr',
        inputTokens: 240,
        outputTokens: 18,
      }),
    );
  });

  it('gửi PDF trực tiếp qua OpenRouter và giữ pageNumber gốc', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  pages: [
                    { pageNumber: 5, text: 'Trang năm' },
                    { pageNumber: 6, text: 'Trang sáu' },
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 900, completion_tokens: 40 },
        }),
    });
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const client = buildClient(recordSafely, 'openrouter-secret');
    const pdf = Buffer.from('%PDF-fake');

    const result = await client.readPdfPagesText(provider(), pdf, [5, 6], {
      source: 'document_vision_ocr',
      referenceId: 'job-pdf',
      userId: 'teacher-pdf',
    });

    expect([...result.pages.entries()]).toEqual([
      [5, 'Trang năm'],
      [6, 'Trang sáu'],
    ]);
    expect(result).toMatchObject({ inputTokens: 900, outputTokens: 40 });
    expect(firstRequestBody()).toMatchObject({
      messages: [
        { role: 'system' },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'pages.pdf',
                file_data: `data:application/pdf;base64,${pdf.toString('base64')}`,
              },
            },
            { type: 'text' },
          ],
        },
      ],
      provider: { require_parameters: true },
    });
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'document_vision_ocr',
        inputTokens: 900,
        outputTokens: 40,
      }),
    );
  });

  it('gửi PDF trực tiếp bằng document block của Anthropic', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                pages: [{ pageNumber: 2, text: 'Nội dung trang hai' }],
              }),
            },
          ],
          stop_reason: 'end_turn',
          usage: { input_tokens: 500, output_tokens: 20 },
        }),
    });
    const client = buildClient(jest.fn().mockResolvedValue(undefined), 'key');
    const pdf = Buffer.from('%PDF-anthropic');

    await client.readPdfPagesText(
      provider({
        name: 'Anthropic Claude',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-sonnet-4-6',
      }),
      pdf,
      [2],
      {
        source: 'document_vision_ocr',
        referenceId: 'job-pdf',
        userId: 'teacher-pdf',
      },
    );

    const request = firstRequestBody();
    expect(request).toMatchObject({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf.toString('base64'),
              },
            },
            { type: 'text' },
          ],
        },
      ],
    });
  });

  it('gửi PDF native qua Gemini generateContent với inlineData', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      pages: [{ pageNumber: 7, text: 'Nội dung trang bảy' }],
                    }),
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 650,
            candidatesTokenCount: 25,
          },
        }),
    });
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const client = buildClient(recordSafely, 'gemini-secret');
    const pdf = Buffer.from('%PDF-gemini');

    const result = await client.readPdfPagesText(
      provider({
        name: 'Gemini direct',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash',
      }),
      pdf,
      [7],
      {
        source: 'document_vision_ocr',
        referenceId: 'job-pdf',
        userId: 'teacher-pdf',
      },
    );

    const fetchCall = (global.fetch as jest.MockedFunction<typeof global.fetch>)
      .mock.calls[0];
    expect(fetchCall?.[0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(new Headers(fetchCall?.[1]?.headers).get('x-goog-api-key')).toBe(
      'gemini-secret',
    );
    expect(firstRequestBody()).toMatchObject({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdf.toString('base64'),
              },
            },
            { text: expect.any(String) as unknown },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: expect.any(Object) as unknown,
        temperature: 0.2,
      },
    });
    expect([...result.pages.entries()]).toEqual([[7, 'Nội dung trang bảy']]);
    expect(result).toMatchObject({ inputTokens: 650, outputTokens: 25 });
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 650, outputTokens: 25 }),
    );
  });

  it('rejects missing or duplicate pages in PDF provider output', () => {
    expect(() =>
      parsePdfPagesReply(
        JSON.stringify({
          pages: [
            { pageNumber: 1, text: 'A' },
            { pageNumber: 1, text: 'B' },
          ],
        }),
        [1, 2],
      ),
    ).toThrow('bị trả trùng');
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
