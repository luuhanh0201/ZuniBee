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
import {
  inferProviderDriver,
  providerDriverFor,
  type AiProviderDriver,
} from './ai-provider-driver';
import {
  AiProviderSdkError,
  AiProviderSdkService,
} from './ai-provider-sdk.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';
import { DiscoverAiProviderModelsDto } from './dto/discover-ai-provider-models.dto';
import { TestAiProviderConnectionDto } from './dto/test-ai-provider-connection.dto';

type CountRow = { providerId: string; count: string };

/** PNG 1×1 hợp lệ để probe đúng request vision mà không mang dữ liệu người dùng. */
const VISION_PROBE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0NwAAAABJRU5ErkJggg==',
  'base64',
);

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
    private readonly sdk: AiProviderSdkService,
  ) {}

  async list(activeOnly = false): Promise<AiProvider[]> {
    const rows = await this.repository.find({
      where: activeOnly ? { isActive: true } : {},
      order: {
        isDefault: 'DESC',
        isVisionDefault: 'DESC',
        isAnalysisDefault: 'DESC',
        name: 'ASC',
      },
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
    if (!id) return this.resolveQuiz();
    const row = await this.repository.findOne({
      where: { id, isActive: true },
    });
    if (!row)
      throw new NotFoundException('Provider AI không tồn tại hoặc đang tắt');
    return row;
  }

  async resolveQuiz(): Promise<AiProviderEntity> {
    const row = await this.repository.findOne({
      where: { isDefault: true, isActive: true },
    });
    if (!row)
      throw new NotFoundException(
        'Chưa cấu hình provider AI dùng để tổng hợp và sinh quiz',
      );
    return row;
  }

  async resolveVision(): Promise<AiProviderEntity> {
    const row = await this.repository.findOne({
      where: { isVisionDefault: true, isActive: true },
    });
    if (!row)
      throw new NotFoundException(
        'Chưa cấu hình provider AI dùng để đọc ảnh/OCR',
      );
    return row;
  }

  /**
   * Provider phân tích chunk. Đây là nhiệm vụ tùy chọn: khi admin chưa giao
   * cho provider nào, phân tích chạy trên provider quiz như trước.
   */
  async resolveAnalysis(): Promise<AiProviderEntity> {
    const row = await this.repository.findOne({
      where: { isAnalysisDefault: true, isActive: true },
    });
    return row ?? (await this.resolveQuiz());
  }

  async create(dto: CreateAiProviderDto): Promise<AiProvider> {
    const baseUrl = normalizeBaseUrl(dto.baseUrl);
    const driver = dto.driver ?? inferProviderDriver(dto.kind, baseUrl);
    const row = await this.dataSource.transaction(async (manager) => {
      if (dto.isDefault)
        await manager.update(
          AiProviderEntity,
          { isDefault: true },
          { isDefault: false },
        );
      if (dto.isVisionDefault)
        await manager.update(
          AiProviderEntity,
          { isVisionDefault: true },
          { isVisionDefault: false },
        );
      if (dto.isAnalysisDefault)
        await manager.update(
          AiProviderEntity,
          { isAnalysisDefault: true },
          { isAnalysisDefault: false },
        );
      const entity = manager.create(AiProviderEntity, {
        ...dto,
        baseUrl,
        driver,
        encryptedApiKey: dto.apiKey ? this.secrets.encrypt(dto.apiKey) : null,
        isActive:
          dto.isDefault || dto.isVisionDefault || dto.isAnalysisDefault
            ? true
            : (dto.isActive ?? true),
        isVisionDefault: dto.isVisionDefault ?? false,
        isAnalysisDefault: dto.isAnalysisDefault ?? false,
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
        (current.isDefault ||
          current.isVisionDefault ||
          current.isAnalysisDefault) &&
        dto.isActive === false &&
        (current.isDefault ? dto.isDefault !== false : true) &&
        (current.isVisionDefault ? dto.isVisionDefault !== false : true) &&
        (current.isAnalysisDefault ? dto.isAnalysisDefault !== false : true)
      ) {
        throw new BadRequestException(
          'Provider đang được giao nhiệm vụ AI phải luôn được bật',
        );
      }
      if (dto.isDefault)
        await manager.update(
          AiProviderEntity,
          { isDefault: true },
          { isDefault: false },
        );
      if (dto.isVisionDefault)
        await manager.update(
          AiProviderEntity,
          { isVisionDefault: true },
          { isVisionDefault: false },
        );
      if (dto.isAnalysisDefault)
        await manager.update(
          AiProviderEntity,
          { isAnalysisDefault: true },
          { isAnalysisDefault: false },
        );
      const connectionChanged =
        dto.kind !== undefined ||
        dto.driver !== undefined ||
        dto.baseUrl !== undefined ||
        dto.model !== undefined ||
        dto.apiKey !== undefined;
      if (dto.name !== undefined) current.name = dto.name;
      if (dto.kind !== undefined) current.kind = dto.kind;
      if (dto.driver !== undefined) current.driver = dto.driver;
      if (dto.baseUrl !== undefined)
        current.baseUrl = normalizeBaseUrl(dto.baseUrl);
      if (dto.baseUrl !== undefined && dto.driver === undefined)
        current.driver = inferProviderDriver(current.kind, current.baseUrl);
      if (dto.model !== undefined) current.model = dto.model;
      if (dto.apiKey !== undefined)
        current.encryptedApiKey = dto.apiKey
          ? this.secrets.encrypt(dto.apiKey)
          : null;
      if (dto.isActive !== undefined) current.isActive = dto.isActive;
      if (dto.isDefault !== undefined) current.isDefault = dto.isDefault;
      if (dto.isVisionDefault !== undefined)
        current.isVisionDefault = dto.isVisionDefault;
      if (dto.isAnalysisDefault !== undefined)
        current.isAnalysisDefault = dto.isAnalysisDefault;
      if (dto.isDefault || dto.isVisionDefault || dto.isAnalysisDefault)
        current.isActive = true;
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
    if (row.isDefault || row.isVisionDefault || row.isAnalysisDefault)
      throw new BadRequestException(
        'Hãy chuyển các nhiệm vụ AI sang provider khác trước khi xóa',
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
        driver: providerDriverFor(row),
        baseUrl: row.baseUrl,
        model: row.model,
        apiKey: this.apiKey(row),
        vision: row.isVisionDefault,
      });
      row.healthStatus = AiProviderHealthStatus.ONLINE;
      row.lastHealthLatencyMs = Date.now() - startedAt;
      row.lastHealthCheckedAt = new Date();
      row.lastHealthError = null;
      await this.repository.save(row);
      this.logger.log(
        `Provider inference probe succeeded: name=${row.name} model=${row.model} latency=${row.lastHealthLatencyMs}ms`,
      );
      return {
        ok: true,
        message: `Inference thử nghiệm thành công trong ${row.lastHealthLatencyMs} ms`,
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
        `Provider inference probe failed: name=${row.name} model=${row.model} reason=${message}`,
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
        driver: dto.driver,
        baseUrl,
        model: dto.model.trim(),
        apiKey: dto.apiKey?.trim() || null,
      });
      const latencyMs = Date.now() - startedAt;
    this.logger.log(
        `Provider draft inference probe succeeded: kind=${dto.kind} model=${dto.model} latency=${latencyMs}ms`,
      );
      return {
        ok: true,
        message: `Inference thử nghiệm thành công trong ${latencyMs} ms`,
        latencyMs,
      };
    } catch (error) {
      const message = providerErrorMessage(error);
      this.logger.warn(
        `Provider draft inference probe failed: kind=${dto.kind} model=${dto.model} reason=${message}`,
      );
      return { ok: false, message, latencyMs: null };
    }
  }

  async discoverModels(
    dto: DiscoverAiProviderModelsDto,
  ): Promise<DiscoverAiProviderModelsResponse> {
    const baseUrl = normalizeBaseUrl(dto.baseUrl);
    await this.urlPolicy.assertAllowed(dto.kind, baseUrl);
    try {
      const models = await this.listProviderModels({
        kind: dto.kind,
        driver: dto.driver,
        baseUrl,
        apiKey: dto.apiKey?.trim() || null,
      });
      if (!models.length)
        throw new BadGatewayException(
          'Provider không trả về model tương thích nào',
        );
      this.logger.log(
        `Discovered provider models: kind=${dto.kind} count=${models.length}`,
      );
      return {
        models: models
          .map((model) => model.id)
          .sort((left, right) => left.localeCompare(right)),
      };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(providerErrorMessage(error));
    }
  }

  async discoverSavedModels(
    id: string,
  ): Promise<DiscoverAiProviderModelsResponse> {
    const row = await this.repository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Provider AI không tồn tại');
    return this.discoverModels({
      kind: row.kind,
      driver: providerDriverFor(row),
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
    if (
      dto.kind === AiProviderKind.OLLAMA ||
      (dto.driver ?? inferProviderDriver(dto.kind, baseUrl)) !== 'openrouter'
    ) {
      return { inputUsdPer1m: null, outputUsdPer1m: null, source: null };
    }
    try {
      const model = (
        await this.listProviderModels({
          kind: dto.kind,
          driver: dto.driver,
          baseUrl,
          apiKey: dto.apiKey?.trim() || null,
        })
      ).find((item) => item.id === dto.model.trim().replace(/^models\//, ''));
      if (
        !model ||
        model.inputUsdPer1m === null ||
        model.outputUsdPer1m === null
      )
        throw new BadGatewayException(
          'Provider không công bố giá cho model đã chọn',
        );
      return {
        inputUsdPer1m: model.inputUsdPer1m,
        outputUsdPer1m: model.outputUsdPer1m,
        source: 'openrouter',
      };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(providerErrorMessage(error));
    }
  }

  async discoverSavedPricing(id: string): Promise<AiProviderPricingSuggestion> {
    const row = await this.repository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Provider AI không tồn tại');
    return this.discoverPricing({
      kind: row.kind,
      driver: providerDriverFor(row),
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
      driver: providerDriverFor(row),
      baseUrl: row.baseUrl,
      model: row.model,
      isActive: row.isActive,
      isDefault: row.isDefault,
      isVisionDefault: row.isVisionDefault,
      isAnalysisDefault: row.isAnalysisDefault,
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
    driver?: AiProviderDriver;
    baseUrl: string;
    model: string;
    apiKey: string | null;
    /** Provider OCR phải nhận một ảnh thật để kiểm tra đúng modality. */
    vision?: boolean;
  }): Promise<void> {
    const models = await this.listProviderModels(configuration);
    const model = configuration.model.trim().replace(/^models\//, '');
    if (!models.some((item) => item.id === model))
      throw new Error('Provider không có model đã chọn');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const reply = await this.sdk.generate({
        provider: {
          kind: configuration.kind,
          driver:
            configuration.driver ??
            inferProviderDriver(configuration.kind, configuration.baseUrl),
          baseUrl: configuration.baseUrl,
          model,
        } as AiProviderEntity,
        apiKey: configuration.apiKey,
        system: 'Bạn là probe nội bộ để xác nhận provider AI đang hoạt động.',
        prompt: 'Trả lời chính xác một từ: OK',
        plan: { mode: 'prompt_json', schema: null, promptInstruction: null },
        ...(configuration.vision
          ? {
              attachment: {
                kind: 'image' as const,
                data: VISION_PROBE_PNG,
                mediaType: 'image/png' as const,
              },
            }
          : {}),
        maxOutputTokens: 32,
        temperature: 0,
        timeoutMs: 20_000,
        signal: controller.signal,
      });
      if (reply.refused || reply.truncated || !reply.content?.trim())
        throw new Error('Provider không hoàn tất inference thử nghiệm');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async listProviderModels(configuration: {
    kind: AiProviderKind;
    driver?: AiProviderDriver;
    baseUrl: string;
    apiKey: string | null;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await this.sdk.listModels({
        driver:
          configuration.driver ??
          inferProviderDriver(configuration.kind, configuration.baseUrl),
        baseUrl: configuration.baseUrl,
        apiKey: configuration.apiKey,
        timeoutMs: 15_000,
        signal: controller.signal,
      });
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
  if (error instanceof AiProviderSdkError) {
    if (error.statusCode === 401)
      return 'API key không hợp lệ, đã hết hạn hoặc không đúng loại (HTTP 401)';
    if (error.statusCode) return `Provider trả HTTP ${error.statusCode}`;
    if (/abort|timeout/i.test(error.message))
      return 'Provider không phản hồi trong 15 giây';
    return `Provider không xử lý inference: ${error.message.slice(0, 300)}`;
  }
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
