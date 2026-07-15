import {
  AiProviderService,
  extractProviderModels,
} from './ai-provider.service';
import {
  AiProviderHealthStatus,
  AiProviderKind,
  AiProviderEntity,
} from './entities/ai-provider.entity';

function provider(overrides: Partial<AiProviderEntity> = {}): AiProviderEntity {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Ollama local',
    kind: AiProviderKind.OLLAMA,
    baseUrl: 'http://host.docker.internal:11434',
    model: 'llama3.1:8b',
    encryptedApiKey: null,
    isActive: true,
    isDefault: true,
    isVisionDefault: true,
    baseCreditCost: 1,
    creditCostPer1kTokens: 0,
    inputUsdPer1m: null,
    outputUsdPer1m: null,
    healthStatus: AiProviderHealthStatus.UNKNOWN,
    lastHealthLatencyMs: null,
    lastHealthCheckedAt: null,
    lastHealthError: null,
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    updatedAt: new Date('2026-07-14T00:00:00.000Z'),
    ...overrides,
  };
}

function countRepository(count = 0) {
  const query = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    groupBy: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(
      count
        ? [
            {
              providerId: '00000000-0000-4000-8000-000000000001',
              count: String(count),
            },
          ]
        : [],
    ),
  };
  query.select.mockReturnValue(query);
  query.addSelect.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.groupBy.mockReturnValue(query);
  return {
    count: jest.fn().mockResolvedValue(count),
    createQueryBuilder: jest.fn().mockReturnValue(query),
  };
}

describe('AiProviderService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('creates a default provider without using an empty update criteria', async () => {
    const saved = provider({ name: 'OpenAI compatible' });
    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockReturnValue(saved),
      save: jest.fn().mockResolvedValue(saved),
    };
    const dataSource = {
      transaction: jest.fn(
        async (callback: (transactionManager: typeof manager) => unknown) =>
          await callback(manager),
      ),
    };
    const service = new AiProviderService(
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
      { encrypt: jest.fn().mockReturnValue('encrypted') } as never,
      {} as never,
    );

    await service.create({
      name: saved.name,
      kind: saved.kind,
      baseUrl: saved.baseUrl,
      model: saved.model,
      isDefault: true,
    });

    expect(manager.update).toHaveBeenCalledWith(
      AiProviderEntity,
      { isDefault: true },
      { isDefault: false },
    );
    expect(manager.update).not.toHaveBeenCalledWith(
      AiProviderEntity,
      {},
      expect.anything(),
    );
    expect(manager.save).toHaveBeenCalledWith(saved);
  });

  it('resolves the active provider assigned to vision OCR', async () => {
    const row = provider({
      isDefault: false,
      isVisionDefault: true,
      name: 'Vision AI',
    });
    const repository = { findOne: jest.fn().mockResolvedValue(row) };
    const service = new AiProviderService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.resolveVision()).resolves.toBe(row);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { isVisionDefault: true, isActive: true },
    });
  });

  it('assigns the vision role exclusively and keeps that provider active', async () => {
    const saved = provider({
      isDefault: false,
      isVisionDefault: true,
      name: 'Vision AI',
    });
    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockReturnValue(saved),
      save: jest.fn().mockResolvedValue(saved),
    };
    const dataSource = {
      transaction: jest.fn(
        async (callback: (transactionManager: typeof manager) => unknown) =>
          await callback(manager),
      ),
    };
    const service = new AiProviderService(
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
      { encrypt: jest.fn().mockReturnValue('encrypted') } as never,
      {} as never,
    );

    await service.create({
      name: saved.name,
      kind: saved.kind,
      baseUrl: saved.baseUrl,
      model: saved.model,
      isActive: false,
      isVisionDefault: true,
    });

    expect(manager.update).toHaveBeenCalledWith(
      AiProviderEntity,
      { isVisionDefault: true },
      { isVisionDefault: false },
    );
    expect(manager.create).toHaveBeenCalledWith(
      AiProviderEntity,
      expect.objectContaining({
        isActive: true,
        isVisionDefault: true,
      }),
    );
  });

  it('runs a real Ollama model probe and persists the measured health', async () => {
    const row = provider();
    const repository = {
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn().mockResolvedValue(row),
    };
    const generationJobs = countRepository(2);
    const insights = countRepository(1);
    const policy = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: { cancel: jest.fn().mockResolvedValue(undefined) },
    });
    const service = new AiProviderService(
      repository as never,
      generationJobs as never,
      insights as never,
      {} as never,
      { decrypt: jest.fn().mockReturnValue(null) } as never,
      policy as never,
    );

    const result = await service.testConnection(row.id);

    expect(policy.assertAllowed).toHaveBeenCalledWith(row.kind, row.baseUrl);
    expect(global.fetch).toHaveBeenCalledWith(
      `${row.baseUrl}/api/show`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: row.model }),
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      provider: { healthStatus: 'online', requestCount: 3 },
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        healthStatus: AiProviderHealthStatus.ONLINE,
        lastHealthError: null,
      }),
    );
  });

  it('persists an offline result instead of returning fake success', async () => {
    const row = provider();
    const repository = {
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn().mockResolvedValue(row),
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      body: { cancel: jest.fn().mockResolvedValue(undefined) },
    });
    const service = new AiProviderService(
      repository as never,
      countRepository() as never,
      countRepository() as never,
      {} as never,
      { decrypt: jest.fn().mockReturnValue(null) } as never,
      { assertAllowed: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const result = await service.testConnection(row.id);

    expect(result).toMatchObject({
      ok: false,
      message: 'Provider trả HTTP 404',
      provider: {
        healthStatus: 'offline',
        lastHealthError: 'Provider trả HTTP 404',
      },
    });
  });

  it('derives dashboard metrics from stored checks and real usage rows', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([
        provider({
          healthStatus: AiProviderHealthStatus.ONLINE,
          lastHealthLatencyMs: 120,
        }),
        provider({
          id: '00000000-0000-4000-8000-000000000002',
          isDefault: false,
          healthStatus: AiProviderHealthStatus.ONLINE,
          lastHealthLatencyMs: 180,
        }),
      ]),
    };
    const generationJobs = countRepository(7);
    const insights = countRepository(3);
    const service = new AiProviderService(
      repository as never,
      generationJobs as never,
      insights as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.metrics()).resolves.toEqual({
      totalProviders: 2,
      activeProviders: 2,
      onlineProviders: 2,
      requestsThisMonth: 10,
      averageLatencyMs: 150,
    });
  });

  it('extracts unique Ollama model names from the live tags response', () => {
    expect(
      extractProviderModels(
        {
          models: [
            { name: 'llama3.1:8b' },
            { model: 'qwen3:8b' },
            { name: 'llama3.1:8b' },
            { name: 123 },
          ],
        },
        true,
      ),
    ).toEqual(['llama3.1:8b', 'qwen3:8b']);
  });

  it('extracts unique model ids from an OpenAI-compatible response', () => {
    expect(
      extractProviderModels(
        {
          data: [
            { id: 'gpt-5-mini' },
            { id: 'gpt-4.1-mini' },
            { id: 'gpt-5-mini' },
            { id: null },
          ],
        },
        false,
      ),
    ).toEqual(['gpt-4.1-mini', 'gpt-5-mini']);
  });

  it('discovers models from an OpenAI-compatible provider with bearer auth', async () => {
    const policy = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [{ id: 'gpt-5-mini' }, { id: 'gpt-4.1-mini' }],
      }),
    });
    const service = new AiProviderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      policy as never,
    );

    await expect(
      service.discoverModels({
        kind: AiProviderKind.OPENAI_COMPATIBLE,
        baseUrl: 'https://api.openai.com/v1/',
        apiKey: 'secret-key',
      }),
    ).resolves.toEqual({ models: ['gpt-4.1-mini', 'gpt-5-mini'] });
    expect(policy.assertAllowed).toHaveBeenCalledWith(
      AiProviderKind.OPENAI_COMPATIBLE,
      'https://api.openai.com/v1',
    );
    const fetchCall = (global.fetch as jest.MockedFunction<typeof global.fetch>)
      .mock.calls[0];
    expect(fetchCall?.[0]).toBe('https://api.openai.com/v1/models');
    expect(fetchCall?.[1]?.method).toBe('GET');
    expect(new Headers(fetchCall?.[1]?.headers).get('Authorization')).toBe(
      'Bearer secret-key',
    );
  });

  it('uses Anthropic API key headers when discovering Claude models', async () => {
    const policy = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [{ id: 'claude-fable-5' }, { id: 'claude-sonnet-5' }],
      }),
    });
    const service = new AiProviderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      policy as never,
    );

    await expect(
      service.discoverModels({
        kind: AiProviderKind.OPENAI_COMPATIBLE,
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: 'anthropic-secret-key',
      }),
    ).resolves.toEqual({ models: ['claude-fable-5', 'claude-sonnet-5'] });
    const fetchCall = (global.fetch as jest.MockedFunction<typeof global.fetch>)
      .mock.calls[0];
    const headers = new Headers(fetchCall?.[1]?.headers);
    expect(headers.get('x-api-key')).toBe('anthropic-secret-key');
    expect(headers.get('anthropic-version')).toBe('2023-06-01');
    expect(headers.get('Authorization')).toBeNull();
  });

  it('reports an Anthropic 401 as an API key error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      body: { cancel: jest.fn().mockResolvedValue(undefined) },
    });
    const service = new AiProviderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { assertAllowed: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(
      service.testConfiguration({
        kind: AiProviderKind.OPENAI_COMPATIBLE,
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-fable-5',
        apiKey: 'expired-anthropic-key',
      }),
    ).resolves.toEqual({
      ok: false,
      message:
        'API key không hợp lệ, đã hết hạn hoặc không đúng loại (HTTP 401)',
      latencyMs: null,
    });
    const fetchCall = (global.fetch as jest.MockedFunction<typeof global.fetch>)
      .mock.calls[0];
    expect(new Headers(fetchCall?.[1]?.headers).get('x-api-key')).toBe(
      'expired-anthropic-key',
    );
  });

  it('discovers locally installed Ollama models from api/tags', async () => {
    const policy = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        models: [{ name: 'llama3.1:8b' }, { name: 'qwen3:8b' }],
      }),
    });
    const service = new AiProviderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      policy as never,
    );

    await expect(
      service.discoverModels({
        kind: AiProviderKind.OLLAMA,
        baseUrl: 'http://host.docker.internal:11434',
      }),
    ).resolves.toEqual({ models: ['llama3.1:8b', 'qwen3:8b'] });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://host.docker.internal:11434/api/tags',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('tests an unsaved provider configuration without persisting it', async () => {
    const policy = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: [{ id: 'gpt-5-mini' }] }),
    });
    const repository = { save: jest.fn() };
    const service = new AiProviderService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      policy as never,
    );

    const result = await service.testConfiguration({
      kind: AiProviderKind.OPENAI_COMPATIBLE,
      baseUrl: 'https://api.openai.com/v1/',
      model: 'gpt-5-mini',
      apiKey: 'secret-key',
    });

    expect(result.ok).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
    expect(policy.assertAllowed).toHaveBeenCalledWith(
      AiProviderKind.OPENAI_COMPATIBLE,
      'https://api.openai.com/v1',
    );
    const fetchCall = (global.fetch as jest.MockedFunction<typeof global.fetch>)
      .mock.calls[0];
    expect(fetchCall?.[0]).toBe('https://api.openai.com/v1/models');
    expect(fetchCall?.[1]?.method).toBe('GET');
    expect(new Headers(fetchCall?.[1]?.headers).get('Authorization')).toBe(
      'Bearer secret-key',
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
