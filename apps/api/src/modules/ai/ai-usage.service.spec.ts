import type { Repository } from 'typeorm';
import { AiUsageService, calculateUsageCostUsd } from './ai-usage.service';
import {
  AiModelClientService,
  parsePdfPagesReply,
} from './ai-model-client.service';
import { extractOpenRouterPricing } from './ai-provider.service';
import type { AiProviderService } from './ai-provider.service';
import type { AiProviderUrlPolicyService } from './ai-provider-url-policy.service';
import { AiProviderSdkError, type AiSdkReply } from './ai-provider-sdk.service';
import { AiProviderDriver } from './ai-provider-driver';
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

function provider(overrides: Partial<AiProviderEntity> = {}): AiProviderEntity {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'OpenRouter',
    kind: AiProviderKind.OPENAI_COMPATIBLE,
    driver: AiProviderDriver.OPENROUTER,
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

function reply(overrides: Partial<AiSdkReply> = {}): AiSdkReply {
  return {
    content: '{"ok":true}',
    inputTokens: 120,
    outputTokens: 45,
    cacheInputTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    providerCostUsd: null,
    providerRequestId: null,
    finishReason: 'stop',
    refused: false,
    truncated: false,
    httpStatus: 200,
    ...overrides,
  };
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
  });
});

describe('extractOpenRouterPricing', () => {
  it('đọc giá USD/token và quy về USD/1M token', () => {
    expect(
      extractOpenRouterPricing(
        {
          data: [
            {
              id: 'google/gemini-3.5-flash',
              pricing: { prompt: '0.0000003', completion: '0.0000025' },
            },
          ],
        },
        'google/gemini-3.5-flash',
      ),
    ).toEqual({ inputUsdPer1m: 0.3, outputUsdPer1m: 2.5 });
  });
});

describe('AiUsageService.record', () => {
  it('ưu tiên chi phí provider trả về và lưu chi tiết accounting', async () => {
    const saved: Partial<AiUsageEventEntity>[] = [];
    const repository = {
      create: jest.fn((value: Partial<AiUsageEventEntity>) => value),
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
      cacheInputTokens: 200,
      cacheWriteTokens: 25,
      reasoningTokens: 50,
      providerCostUsd: 0.0042,
      providerRequestId: 'gen-123',
    });

    expect(saved[0]).toMatchObject({
      inputTokens: 1_500,
      outputTokens: 2_000,
      cacheInputTokens: 200,
      cacheWriteTokens: 25,
      reasoningTokens: 50,
      providerCostUsd: 0.0042,
      costUsd: 0.0042,
      costSource: 'provider_response',
      providerRequestId: 'gen-123',
    });
  });

  it('gắn cost source local khi Ollama không có rate card', async () => {
    const repository = {
      create: jest.fn((value: Partial<AiUsageEventEntity>) => value),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as Repository<AiUsageEventEntity>;
    const service = new AiUsageService(repository);

    await service.record({
      provider: provider({
        driver: AiProviderDriver.OLLAMA,
        inputUsdPer1m: null,
        outputUsdPer1m: null,
      }),
      source: 'quiz_generation',
      referenceId: null,
      userId: null,
      inputTokens: 1,
      outputTokens: 1,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ costUsd: null, costSource: 'local' }),
    );
  });
});

describe('AiModelClientService + SDK usage', () => {
  function buildClient(
    recordSafely: jest.Mock,
    sdkGenerate: jest.Mock,
    apiKey: string | null = 'provider-secret',
  ) {
    return new AiModelClientService(
      { apiKey: () => apiKey } as unknown as AiProviderService,
      {
        assertAllowed: jest.fn().mockResolvedValue(undefined),
      } as unknown as AiProviderUrlPolicyService,
      { recordSafely } as unknown as AiUsageService,
      { generate: sdkGenerate } as never,
    );
  }

  it('ghi token/cost/request id do SDK trả về', async () => {
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const sdkGenerate = jest.fn().mockResolvedValue(
      reply({
        cacheInputTokens: 10,
        cacheWriteTokens: 3,
        reasoningTokens: 7,
        providerCostUsd: 0.00123,
        providerRequestId: 'router-req-1',
      }),
    );
    const client = buildClient(recordSafely, sdkGenerate);

    await expect(
      client.completeJson(
        provider(),
        'system',
        'prompt',
        { source: 'quiz_insight', referenceId: 'ref-1', userId: 'user-1' },
        OUTPUT_SCHEMA,
      ),
    ).resolves.toEqual({
      value: { ok: true },
      inputTokens: 120,
      outputTokens: 45,
    });

    expect(sdkGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'provider-secret',
        system: 'system',
        prompt: 'prompt',
        maxOutputTokens: 16_384,
      }),
    );
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheInputTokens: 10,
        cacheWriteTokens: 3,
        reasoningTokens: 7,
        providerCostUsd: 0.00123,
        providerRequestId: 'router-req-1',
      }),
    );
  });

  it('gửi ảnh qua attachment SDK và ghi nguồn OCR', async () => {
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const sdkGenerate = jest.fn().mockResolvedValue(
      reply({
        content: 'Nội dung nhìn thấy trên trang.',
        inputTokens: 240,
        outputTokens: 18,
      }),
    );
    const client = buildClient(recordSafely, sdkGenerate);
    const image = Buffer.from('fake-png');

    await expect(
      client.readImageText(
        provider(),
        image,
        'image/png',
        {
          source: 'document_vision_ocr',
          referenceId: '00000000-0000-4000-8000-000000000009',
          userId: '00000000-0000-4000-8000-000000000010',
        },
        3,
      ),
    ).resolves.toMatchObject({ inputTokens: 240, outputTokens: 18 });

    expect(sdkGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment: { kind: 'image', data: image, mediaType: 'image/png' },
        temperature: 0,
      }),
    );
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'document_vision_ocr' }),
    );
  });

  it('gửi PDF native qua attachment SDK và giữ page number gốc', async () => {
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const sdkGenerate = jest.fn().mockResolvedValue(
      reply({
        content: JSON.stringify({
          pages: [
            { pageNumber: 5, text: 'Trang năm' },
            { pageNumber: 6, text: 'Trang sáu' },
          ],
        }),
        inputTokens: 900,
        outputTokens: 40,
      }),
    );
    const client = buildClient(recordSafely, sdkGenerate);
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
    expect(sdkGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment: { kind: 'pdf', data: pdf, mediaType: 'application/pdf' },
        maxOutputTokens: 16_384,
      }),
    );
  });

  it('phân loại lỗi SDK, giữ status/request id và không retry lỗi 429', async () => {
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const sdkGenerate = jest
      .fn()
      .mockRejectedValue(
        new AiProviderSdkError('rate limited', 429, 'req-429'),
      );
    const client = buildClient(recordSafely, sdkGenerate);

    await expect(
      client.completeJson(
        provider(),
        'system',
        'prompt',
        { source: 'quiz_generation', referenceId: null, userId: null },
        OUTPUT_SCHEMA,
      ),
    ).rejects.toMatchObject({
      details: { category: 'provider_rate_limit', retryable: true },
    });
    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        httpStatus: 429,
        providerRequestId: 'req-429',
      }),
    );
  });

  it('vẫn ghi usage khi SDK trả JSON không hợp lệ', async () => {
    const recordSafely = jest.fn().mockResolvedValue(undefined);
    const sdkGenerate = jest
      .fn()
      .mockResolvedValue(reply({ content: 'không phải json' }));
    const client = buildClient(recordSafely, sdkGenerate);

    await expect(
      client.completeJson(
        provider(),
        'system',
        'prompt',
        { source: 'quiz_generation', referenceId: null, userId: null },
        OUTPUT_SCHEMA,
      ),
    ).rejects.toThrow('Provider AI trả JSON không hợp lệ');
    expect(recordSafely).toHaveBeenCalledTimes(1);
  });
});

describe('parsePdfPagesReply', () => {
  it('từ chối page bị trùng', () => {
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
});
