import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import type {
  AiProvider,
  AiProviderMetrics,
  AiProviderPricingSuggestion,
  AiProviderTestResult,
  DiscoverAiProviderModelsResponse,
  TestAiProviderConnectionResponse,
} from '@zunibee/shared';
import {
  AiProviderEntity,
  AiProviderHealthStatus,
  AiProviderKind,
} from './entities/ai-provider.entity';
import { AiGenerationJobEntity } from './entities/ai-generation-job.entity';
import { QuizWeaknessInsightEntity } from './entities/quiz-weakness-insight.entity';
import { AiSecretService } from './ai-secret.service';
import { AiProviderUrlPolicyService } from './ai-provider-url-policy.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';
import { DiscoverAiProviderModelsDto } from './dto/discover-ai-provider-models.dto';
import { TestAiProviderConnectionDto } from './dto/test-ai-provider-connection.dto';

type CountRow = { providerId: string; count: string };

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(
    @InjectRepository(AiProviderEntity)
    private readonly repository: Repository<AiProviderEntity>,
    @InjectRepository(AiGenerationJobEntity)
    private readonly generationJobs: Repository<AiGenerationJobEntity>,
    @InjectRepository(QuizWeaknessInsightEntity)
    private readonly insights: Repository<QuizWeaknessInsightEntity>,
    private readonly dataSource: DataSource,
    private readonly secrets: AiSecretService,
    private readonly urlPolicy: AiProviderUrlPolicyService,
  ) {}

  async list(activeOnly = false): Promise<AiProvider[]> {
    const rows = await this.repository.find({
      where: activeOnly ? { isActive: true } : {},
      order: { isDefault: 'DESC', name: 'ASC' },
    });
    const counts = await this.requestCounts(rows.map((row) => row.id));
    return rows.map((row) => this.toResponse(row, counts.get(row.id) ?? 0));
  }

  async metrics(): Promise<AiProviderMetrics> {
    const rows = await this.repository.find();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [generationCount, insightCount] = await Promise.all([
      this.generationJobs.count({
        where: { createdAt: MoreThanOrEqual(monthStart) },
      }),
      this.insights.count({
        where: { createdAt: MoreThanOrEqual(monthStart) },
      }),
    ]);
    const activeRows = rows.filter((row) => row.isActive);
    const onlineRows = activeRows.filter(
      (row) => row.healthStatus === AiProviderHealthStatus.ONLINE,
    );
    const latencies = onlineRows
      .map((row) => row.lastHealthLatencyMs)
      .filter((latency): latency is number => latency !== null);
    return {
      totalProviders: rows.length,
      activeProviders: activeRows.length,
      onlineProviders: onlineRows.length,
      requestsThisMonth: generationCount + insightCount,
      averageLatencyMs: latencies.length
        ? Math.round(
            latencies.reduce((total, latency) => total + latency, 0) /
              latencies.length,
          )
        : null,
    };
  }

  async resolve(id?: string): Promise<AiProviderEntity> {
    const row = id
      ? await this.repository.findOne({ where: { id, isActive: true } })
      : await this.repository.findOne({
          where: { isDefault: true, isActive: true },
        });
    if (!row)
      throw new NotFoundException(
        id
          ? 'Provider AI không tồn tại hoặc đang tắt'
          : 'Chưa cấu hình provider AI mặc định',
      );
    return row;
  }

  async create(dto: CreateAiProviderDto): Promise<AiProvider> {
    const row = await this.dataSource.transaction(async (manager) => {
      if (dto.isDefault)
        await manager.update(
          AiProviderEntity,
          { isDefault: true },
          { isDefault: false },
        );
      const entity = manager.create(AiProviderEntity, {
        ...dto,
        baseUrl: normalizeBaseUrl(dto.baseUrl),
        encryptedApiKey: dto.apiKey ? this.secrets.encrypt(dto.apiKey) : null,
        isActive: dto.isDefault ? true : (dto.isActive ?? true),
        baseCreditCost: dto.baseCreditCost ?? 1,
        creditCostPer1kTokens: dto.creditCostPer1kTokens ?? 1,
        inputUsdPer1m: dto.inputUsdPer1m ?? null,
        outputUsdPer1m: dto.outputUsdPer1m ?? null,
        healthStatus: AiProviderHealthStatus.UNKNOWN,
        lastHealthLatencyMs: null,
        lastHealthCheckedAt: null,
        lastHealthError: null,
      });
      return manager.save(entity);
    });
    return this.toResponse(row, 0);
  }

  async update(id: string, dto: UpdateAiProviderDto): Promise<AiProvider> {
    const row = await this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(AiProviderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) throw new NotFoundException('Provider AI không tồn tại');
      if (
        current.isDefault &&
        dto.isActive === false &&
        dto.isDefault !== false
      ) {
        throw new BadRequestException('Provider mặc định phải luôn được bật');
      }
      if (dto.isDefault)
        await manager.update(
          AiProviderEntity,
          { isDefault: true },
          { isDefault: false },
        );
      const connectionChanged =
        dto.kind !== undefined ||
        dto.baseUrl !== undefined ||
        dto.model !== undefined ||
        dto.apiKey !== undefined;
      if (dto.name !== undefined) current.name = dto.name;
      if (dto.kind !== undefined) current.kind = dto.kind;
      if (dto.baseUrl !== undefined)
        current.baseUrl = normalizeBaseUrl(dto.baseUrl);
      if (dto.model !== undefined) current.model = dto.model;
      if (dto.apiKey !== undefined)
        current.encryptedApiKey = dto.apiKey
          ? this.secrets.encrypt(dto.apiKey)
          : null;
      if (dto.isActive !== undefined) current.isActive = dto.isActive;
      if (dto.isDefault !== undefined) current.isDefault = dto.isDefault;
      if (dto.isDefault) current.isActive = true;
      if (dto.baseCreditCost !== undefined)
        current.baseCreditCost = dto.baseCreditCost;
      if (dto.creditCostPer1kTokens !== undefined)
        current.creditCostPer1kTokens = dto.creditCostPer1kTokens;
      if (dto.inputUsdPer1m !== undefined)
        current.inputUsdPer1m = dto.inputUsdPer1m;
      if (dto.outputUsdPer1m !== undefined)
        current.outputUsdPer1m = dto.outputUsdPer1m;
      if (connectionChanged) resetHealth(current);
      return manager.save(current);
    });
    return this.toResponse(row, await this.requestCount(id));
  }

  async remove(id: string): Promise<void> {
    const row = await this.repository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Provider AI không tồn tại');
    if (row.isDefault)
      throw new BadRequestException(
        'Hãy chọn provider mặc định khác trước khi xóa',
      );
    try {
      await this.repository.remove(row);
    } catch {
      throw new BadRequestException(
        'Provider đã có lịch sử sử dụng, hãy tắt thay vì xóa',
      );
    }
  }

  async testConnection(id: string): Promise<AiProviderTestResult> {
    const row = await this.repository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Provider AI không tồn tại');
    const startedAt = Date.now();
    try {
      await this.urlPolicy.assertAllowed(row.kind, row.baseUrl);
      await this.probeConfiguration({
        kind: row.kind,
        baseUrl: row.baseUrl,
        model: row.model,
        apiKey: this.apiKey(row),
      });
      row.healthStatus = AiProviderHealthStatus.ONLINE;
      row.lastHealthLatencyMs = Date.now() - startedAt;
      row.lastHealthCheckedAt = new Date();
      row.lastHealthError = null;
      await this.repository.save(row);
      this.logger.log(
        `Provider test succeeded: name=${row.name} model=${row.model} latency=${row.lastHealthLatencyMs}ms`,
      );
      return {
        ok: true,
        message: `Kết nối thành công trong ${row.lastHealthLatencyMs} ms`,
        provider: this.toResponse(row, await this.requestCount(row.id)),
      };
    } catch (error) {
      const message = providerErrorMessage(error);
      row.healthStatus = AiProviderHealthStatus.OFFLINE;
      row.lastHealthLatencyMs = null;
      row.lastHealthCheckedAt = new Date();
      row.lastHealthError = message.slice(0, 500);
      await this.repository.save(row);
      this.logger.warn(
        `Provider test failed: name=${row.name} model=${row.model} reason=${message}`,
      );
      return {
        ok: false,
        message,
        provider: this.toResponse(row, await this.requestCount(row.id)),
      };
    }
  }

  async testConfiguration(
    dto: TestAiProviderConnectionDto,
  ): Promise<TestAiProviderConnectionResponse> {
    const baseUrl = normalizeBaseUrl(dto.baseUrl);
    const startedAt = Date.now();
    try {
      await this.urlPolicy.assertAllowed(dto.kind, baseUrl);
      await this.probeConfiguration({
        kind: dto.kind,
        baseUrl,
        model: dto.model.trim(),
        apiKey: dto.apiKey?.trim() || null,
      });
      const latencyMs = Date.now() - startedAt;
      this.logger.log(
        `Provider draft test succeeded: kind=${dto.kind} model=${dto.model} latency=${latencyMs}ms`,
      );
      return {
        ok: true,
        message: `Kết nối thành công trong ${latencyMs} ms`,
        latencyMs,
      };
    } catch (error) {
      const message = providerErrorMessage(error);
      this.logger.warn(
        `Provider draft test failed: kind=${dto.kind} model=${dto.model} reason=${message}`,
      );
      return { ok: false, message, latencyMs: null };
    }
  }

  async discoverModels(
    dto: DiscoverAiProviderModelsDto,
  ): Promise<DiscoverAiProviderModelsResponse> {
    const baseUrl = normalizeBaseUrl(dto.baseUrl);
    await this.urlPolicy.assertAllowed(dto.kind, baseUrl);
    const isOllama = dto.kind === AiProviderKind.OLLAMA;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(
        isOllama ? `${baseUrl}/api/tags` : `${baseUrl}/models`,
        {
          method: 'GET',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            ...providerAuthenticationHeaders(
              dto.kind,
              baseUrl,
              dto.apiKey?.trim() || null,
            ),
          },
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new BadGatewayException(
          `Provider trả HTTP ${response.status} khi tải model`,
        );
      }
      const models = extractProviderModels(await response.json(), isOllama);
      if (!models.length)
        throw new BadGatewayException(
          'Provider không trả về model tương thích nào',
        );
      this.logger.log(
        `Discovered provider models: kind=${dto.kind} count=${models.length}`,
      );
      return { models };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof Error && error.name === 'AbortError')
        throw new BadGatewayException(
          'Provider không phản hồi khi tải danh sách model',
        );
      throw new BadGatewayException(
        'Không thể tải danh sách model từ provider',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async discoverSavedModels(
    id: string,
  ): Promise<DiscoverAiProviderModelsResponse> {
    const row = await this.repository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Provider AI không tồn tại');
    return this.discoverModels({
      kind: row.kind,
      baseUrl: row.baseUrl,
      apiKey: this.apiKey(row) ?? undefined,
    });
  }

  /**
   * Lấy đơn giá USD/1M token của model từ provider. Hiện chỉ OpenRouter công
   * bố giá qua API — provider khác trả null để FE dùng giá preset/nhập tay.
   */
  async discoverPricing(
    dto: TestAiProviderConnectionDto,
  ): Promise<AiProviderPricingSuggestion> {
    const baseUrl = normalizeBaseUrl(dto.baseUrl);
    await this.urlPolicy.assertAllowed(dto.kind, baseUrl);
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (
      dto.kind === AiProviderKind.OLLAMA ||
      (hostname !== 'openrouter.ai' && !hostname.endsWith('.openrouter.ai'))
    ) {
      return { inputUsdPer1m: null, outputUsdPer1m: null, source: null };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(dto.apiKey?.trim()
            ? { Authorization: `Bearer ${dto.apiKey.trim()}` }
            : {}),
        },
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new BadGatewayException(
          `Provider trả HTTP ${response.status} khi tải bảng giá`,
        );
      }
      const pricing = extractOpenRouterPricing(
        await response.json(),
        dto.model.trim(),
      );
      if (!pricing)
        throw new BadGatewayException(
          'Provider không công bố giá cho model đã chọn',
        );
      return { ...pricing, source: 'openrouter' };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof Error && error.name === 'AbortError')
        throw new BadGatewayException(
          'Provider không phản hồi khi tải bảng giá',
        );
      throw new BadGatewayException('Không thể tải bảng giá từ provider');
    } finally {
      clearTimeout(timeout);
    }
  }

  async discoverSavedPricing(id: string): Promise<AiProviderPricingSuggestion> {
    const row = await this.repository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Provider AI không tồn tại');
    return this.discoverPricing({
      kind: row.kind,
      baseUrl: row.baseUrl,
      model: row.model,
      apiKey: this.apiKey(row) ?? undefined,
    });
  }

  apiKey(row: AiProviderEntity): string | null {
    return this.secrets.decrypt(row.encryptedApiKey);
  }

  toResponse(row: AiProviderEntity, requestCount = 0): AiProvider {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      baseUrl: row.baseUrl,
      model: row.model,
      isActive: row.isActive,
      isDefault: row.isDefault,
      hasApiKey: Boolean(row.encryptedApiKey),
      baseCreditCost: row.baseCreditCost,
      creditCostPer1kTokens: row.creditCostPer1kTokens,
      inputUsdPer1m: row.inputUsdPer1m ?? null,
      outputUsdPer1m: row.outputUsdPer1m ?? null,
      healthStatus: row.healthStatus ?? AiProviderHealthStatus.UNKNOWN,
      lastHealthLatencyMs: row.lastHealthLatencyMs ?? null,
      lastHealthCheckedAt: row.lastHealthCheckedAt?.toISOString() ?? null,
      lastHealthError: row.lastHealthError ?? null,
      requestCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async probeConfiguration(configuration: {
    kind: AiProviderKind;
    baseUrl: string;
    model: string;
    apiKey: string | null;
  }): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const isOllama = configuration.kind === AiProviderKind.OLLAMA;
      const response = await fetch(
        isOllama
          ? `${configuration.baseUrl}/api/show`
          : `${configuration.baseUrl}/models`,
        {
          method: isOllama ? 'POST' : 'GET',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            ...(isOllama ? { 'Content-Type': 'application/json' } : {}),
            ...providerAuthenticationHeaders(
              configuration.kind,
              configuration.baseUrl,
              configuration.apiKey,
            ),
          },
          body: isOllama
            ? JSON.stringify({ model: configuration.model })
            : undefined,
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Provider trả HTTP ${response.status}`);
      }
      if (isOllama) {
        await response.body?.cancel();
        return;
      }
      const models = extractProviderModels(await response.json(), false);
      if (!models.includes(configuration.model))
        throw new Error('Provider không có model đã chọn');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestCounts(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const [jobRows, insightRows] = await Promise.all([
      this.countByProvider(this.generationJobs, ids),
      this.countByProvider(this.insights, ids),
    ]);
    const counts = new Map<string, number>();
    for (const row of [...jobRows, ...insightRows]) {
      counts.set(
        row.providerId,
        (counts.get(row.providerId) ?? 0) + Number(row.count),
      );
    }
    return counts;
  }

  private countByProvider<T extends { providerId: string }>(
    repository: Repository<T>,
    ids: string[],
  ): Promise<CountRow[]> {
    return repository
      .createQueryBuilder('item')
      .select('item.providerId', 'providerId')
      .addSelect('COUNT(*)', 'count')
      .where('item.providerId IN (:...ids)', { ids })
      .groupBy('item.providerId')
      .getRawMany<CountRow>();
  }

  private async requestCount(id: string): Promise<number> {
    const counts = await this.requestCounts([id]);
    return counts.get(id) ?? 0;
  }
}

function resetHealth(row: AiProviderEntity): void {
  row.healthStatus = AiProviderHealthStatus.UNKNOWN;
  row.lastHealthLatencyMs = null;
  row.lastHealthCheckedAt = null;
  row.lastHealthError = null;
}

function providerErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError')
    return 'Provider không phản hồi trong 15 giây';
  if (error instanceof BadRequestException) return error.message;
  if (error instanceof Error && error.message === 'Provider trả HTTP 401')
    return 'API key không hợp lệ, đã hết hạn hoặc không đúng loại (HTTP 401)';
  if (error instanceof Error && /^Provider trả HTTP \d{3}$/.test(error.message))
    return error.message;
  if (
    error instanceof Error &&
    error.message === 'Provider không có model đã chọn'
  )
    return error.message;
  return 'Không thể kết nối tới provider hoặc model đã cấu hình';
}

function providerAuthenticationHeaders(
  kind: AiProviderKind,
  baseUrl: string,
  apiKey: string | null,
): Record<string, string> {
  if (kind === AiProviderKind.OLLAMA || !apiKey) return {};
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  if (hostname === 'api.anthropic.com') {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

export function extractProviderModels(
  payload: unknown,
  ollama: boolean,
): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const source = ollama
    ? (payload as { models?: unknown }).models
    : (payload as { data?: unknown }).data;
  if (!Array.isArray(source)) return [];
  const values = source
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as { id?: unknown; name?: unknown; model?: unknown };
      const value = ollama ? (record.name ?? record.model) : record.id;
      return typeof value === 'string' && value.length <= 200
        ? value.trim()
        : null;
    })
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 500);
}

/**
 * OpenRouter trả pricing.prompt/completion là USD trên MỖI token (dạng
 * string) — nhân 1 triệu để về đơn giá USD/1M token dùng trong hệ thống.
 */
export function extractOpenRouterPricing(
  payload: unknown,
  model: string,
): { inputUsdPer1m: number; outputUsdPer1m: number } | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const match = data.find(
    (item): item is { id: string; pricing?: unknown } =>
      Boolean(item) &&
      typeof item === 'object' &&
      (item as { id?: unknown }).id === model,
  );
  const pricing = match?.pricing as
    { prompt?: unknown; completion?: unknown } | undefined;
  const input = Number(pricing?.prompt);
  const output = Number(pricing?.completion);
  if (
    !Number.isFinite(input) ||
    !Number.isFinite(output) ||
    input < 0 ||
    output < 0
  )
    return null;
  return {
    inputUsdPer1m: roundUsdPer1m(input * 1_000_000),
    outputUsdPer1m: roundUsdPer1m(output * 1_000_000),
  };
}

/** numeric(12,6) trong DB — làm tròn 6 chữ số thập phân, tránh rác float. */
function roundUsdPer1m(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new BadRequestException('Base URL provider không hợp lệ');
  return value.replace(/\/+$/, '');
}
