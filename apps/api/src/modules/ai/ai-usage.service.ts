import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type {
  AiUsageAnalytics,
  AiUsageAnalyticsFilters,
  AiUsageAnalyticsSummary,
  AiUsageBreakdownRow,
  AiUsageBudget,
  AiUsageEvent,
  AiUsageSource,
  AiUsageStatRow,
  AiUsageStats,
  AiUsageStatus,
  UpsertAiUsageBudgetRequest,
} from '@zunibee/shared';
import { AiUsageEventEntity } from '@/modules/ai/entities/ai-usage-event.entity';
import { AiUsageBudgetEntity } from '@/modules/ai/entities/ai-usage-budget.entity';
import type { AiProviderEntity } from '@/modules/ai/entities/ai-provider.entity';

export type RecordAiUsageInput = {
  provider: AiProviderEntity;
  source: AiUsageSource;
  referenceId: string | null;
  userId: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheInputTokens?: number;
  status?: AiUsageStatus;
  latencyMs?: number | null;
  httpStatus?: number | null;
  finishReason?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

type UsageStatRawRow = {
  provider_id: string;
  provider_name: string;
  model: string;
  source: AiUsageSource;
  requests: string;
  input_tokens: string;
  output_tokens: string;
  cost_usd: string | null;
  unpriced_requests: string;
};

type SummaryRawRow = {
  requests: string;
  successful_requests: string;
  failed_requests: string;
  input_tokens: string;
  output_tokens: string;
  cache_input_tokens: string;
  cost_usd: string;
  unpriced_requests: string;
  average_latency_ms: string | null;
  p95_latency_ms: string | null;
};

type BreakdownRawRow = {
  key: string;
  label: string;
  requests: string;
  failed_requests: string;
  input_tokens: string;
  output_tokens: string;
  cost_usd: string;
  unpriced_requests: string;
  average_latency_ms: string | null;
};

type UsageEventGroupRawRow = {
  id: string;
  request_count: string;
  provider_id: string;
  provider_name: string;
  model: string;
  source: AiUsageSource;
  status: AiUsageStatus;
  reference_id: string | null;
  user_id: string | null;
  input_tokens: string;
  output_tokens: string;
  cache_input_tokens: string;
  cost_usd: string | null;
  latency_ms: string | null;
  http_status: string | null;
  finish_reason: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: Date | string;
  created_at: Date | string;
};

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    @InjectRepository(AiUsageEventEntity)
    private readonly events: Repository<AiUsageEventEntity>,
    @Optional()
    @InjectRepository(AiUsageBudgetEntity)
    private readonly budgets?: Repository<AiUsageBudgetEntity>,
  ) {}

  /** Snapshot provider, model, giá và kết quả tại thời điểm gọi. */
  async record(input: RecordAiUsageInput): Promise<void> {
    const inputTokens = safeInteger(input.inputTokens);
    const outputTokens = safeInteger(input.outputTokens);
    await this.events.save(
      this.events.create({
        providerId: input.provider.id,
        providerName: input.provider.name,
        model: input.provider.model,
        source: input.source,
        status: input.status ?? 'success',
        referenceId: input.referenceId,
        userId: input.userId,
        inputTokens,
        outputTokens,
        cacheInputTokens: safeInteger(input.cacheInputTokens ?? 0),
        inputUsdPer1m: input.provider.inputUsdPer1m,
        outputUsdPer1m: input.provider.outputUsdPer1m,
        costUsd: calculateUsageCostUsd(
          inputTokens,
          outputTokens,
          input.provider.inputUsdPer1m,
          input.provider.outputUsdPer1m,
        ),
        latencyMs:
          input.latencyMs == null ? null : safeInteger(input.latencyMs),
        httpStatus: input.httpStatus ?? null,
        finishReason: truncate(input.finishReason, 80),
        errorCode: truncate(input.errorCode, 80),
        errorMessage: truncate(input.errorMessage, 500),
      }),
    );
  }

  /** Thống kê lỗi không được làm fail request AI. */
  async recordSafely(input: RecordAiUsageInput): Promise<void> {
    try {
      await this.record(input);
    } catch (error) {
      this.logger.warn(
        `Không ghi được usage event (provider=${input.provider.name}, source=${input.source}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** API cũ được giữ để không làm vỡ client hiện tại. */
  async stats(from: Date, to: Date): Promise<AiUsageStats> {
    const raw = await this.events
      .createQueryBuilder('event')
      .select('event.provider_id', 'provider_id')
      .addSelect('event.provider_name', 'provider_name')
      .addSelect('event.model', 'model')
      .addSelect('event.source', 'source')
      .addSelect('COUNT(*)', 'requests')
      .addSelect('SUM(event.input_tokens)', 'input_tokens')
      .addSelect('SUM(event.output_tokens)', 'output_tokens')
      .addSelect('SUM(event.cost_usd)', 'cost_usd')
      .addSelect(
        'COUNT(*) FILTER (WHERE event.cost_usd IS NULL)',
        'unpriced_requests',
      )
      .where('event.created_at >= :from AND event.created_at <= :to', {
        from,
        to,
      })
      .groupBy('event.provider_id')
      .addGroupBy('event.provider_name')
      .addGroupBy('event.model')
      .addGroupBy('event.source')
      .getRawMany<UsageStatRawRow>();

    const rows: AiUsageStatRow[] = raw
      .map((row) => ({
        providerId: row.provider_id,
        providerName: row.provider_name,
        model: row.model,
        source: row.source,
        requests: Number(row.requests),
        inputTokens: Number(row.input_tokens),
        outputTokens: Number(row.output_tokens),
        costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
        unpricedRequests: Number(row.unpriced_requests),
      }))
      .sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: rows.reduce(
        (totals, row) => ({
          requests: totals.requests + row.requests,
          inputTokens: totals.inputTokens + row.inputTokens,
          outputTokens: totals.outputTokens + row.outputTokens,
          costUsd: totals.costUsd + (row.costUsd ?? 0),
          unpricedRequests: totals.unpricedRequests + row.unpricedRequests,
        }),
        {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          unpricedRequests: 0,
        },
      ),
      rows,
    };
  }

  async analytics(filters: AiUsageAnalyticsFilters): Promise<AiUsageAnalytics> {
    const from = new Date(filters.from);
    const to = new Date(filters.to);
    const duration = to.getTime() - from.getTime();
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - duration);
    const granularity = chooseGranularity(from, to);

    const [
      summary,
      previousSummary,
      timeseries,
      byProvider,
      byModel,
      bySource,
      byStatus,
      eventPage,
      budgets,
    ] = await Promise.all([
      this.summary(filters, from, to),
      this.summary(filters, previousFrom, previousTo),
      this.timeseries(filters, from, to, granularity),
      this.breakdown(filters, from, to, 'provider'),
      this.breakdown(filters, from, to, 'model'),
      this.breakdown(filters, from, to, 'source'),
      this.breakdown(filters, from, to, 'status'),
      this.eventPage(filters, from, to),
      this.listBudgets(),
    ]);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
      summary,
      previousSummary,
      timeseries,
      byProvider,
      byModel,
      bySource,
      byStatus,
      events: eventPage.items.map(toUsageEvent),
      eventPagination: eventPage.pagination,
      budgets,
    };
  }

  async exportExcel(filters: AiUsageAnalyticsFilters): Promise<Buffer> {
    const analytics = await this.analytics({
      ...filters,
      eventPage: 1,
      eventPageSize: 5000,
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ZuniBee';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Tổng quan');
    summary.columns = [
      { header: 'Chỉ số', key: 'metric', width: 32 },
      { header: 'Giá trị', key: 'value', width: 22 },
    ];
    summary.addRows([
      { metric: 'Từ', value: analytics.from },
      { metric: 'Đến', value: analytics.to },
      { metric: 'Tổng request', value: analytics.summary.requests },
      {
        metric: 'Request thành công',
        value: analytics.summary.successfulRequests,
      },
      { metric: 'Request lỗi', value: analytics.summary.failedRequests },
      { metric: 'Tỷ lệ thành công (%)', value: analytics.summary.successRate },
      { metric: 'Input token', value: analytics.summary.inputTokens },
      { metric: 'Output token', value: analytics.summary.outputTokens },
      {
        metric: 'Cache input token',
        value: analytics.summary.cacheInputTokens,
      },
      { metric: 'Chi phí (USD)', value: analytics.summary.costUsd },
      {
        metric: 'Request thiếu giá',
        value: analytics.summary.unpricedRequests,
      },
      {
        metric: 'Độ trễ trung bình (ms)',
        value: analytics.summary.averageLatencyMs ?? '',
      },
      {
        metric: 'P95 độ trễ (ms)',
        value: analytics.summary.p95LatencyMs ?? '',
      },
    ]);
    styleWorksheet(summary);

    addBreakdownSheet(workbook, 'Theo provider', analytics.byProvider);
    addBreakdownSheet(workbook, 'Theo model', analytics.byModel);
    addBreakdownSheet(workbook, 'Theo nguồn', analytics.bySource);

    const events = workbook.addWorksheet('Nhật ký request');
    events.columns = [
      { header: 'Bắt đầu', key: 'startedAt', width: 25 },
      { header: 'Kết thúc', key: 'createdAt', width: 25 },
      { header: 'Requests', key: 'requests', width: 12 },
      { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'Provider', key: 'provider', width: 24 },
      { header: 'Model', key: 'model', width: 30 },
      { header: 'Nguồn', key: 'source', width: 24 },
      { header: 'Input token', key: 'input', width: 16 },
      { header: 'Output token', key: 'output', width: 16 },
      { header: 'Cache token', key: 'cache', width: 16 },
      { header: 'Chi phí USD', key: 'cost', width: 16 },
      { header: 'Độ trễ ms', key: 'latency', width: 16 },
      { header: 'HTTP', key: 'http', width: 10 },
      { header: 'Lỗi', key: 'error', width: 55 },
      { header: 'User ID', key: 'userId', width: 38 },
      { header: 'Reference ID', key: 'referenceId', width: 38 },
    ];
    analytics.events.forEach((event) =>
      events.addRow({
        startedAt: event.startedAt,
        createdAt: event.createdAt,
        requests: event.requestCount,
        status: event.status,
        provider: event.providerName,
        model: event.model,
        source: event.source,
        input: event.inputTokens,
        output: event.outputTokens,
        cache: event.cacheInputTokens,
        cost: event.costUsd ?? '',
        latency: event.latencyMs ?? '',
        http: event.httpStatus ?? '',
        error: event.errorMessage ?? '',
        userId: event.userId ?? '',
        referenceId: event.referenceId ?? '',
      }),
    );
    styleWorksheet(events);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async listBudgets(): Promise<AiUsageBudget[]> {
    if (!this.budgets) return [];
    const rows = await this.budgets.find({ order: { createdAt: 'ASC' } });
    return Promise.all(rows.map((budget) => this.toBudget(budget)));
  }

  async createBudget(
    input: UpsertAiUsageBudgetRequest,
    adminId: string,
  ): Promise<AiUsageBudget> {
    const repository = this.requireBudgetRepository();
    const entity = await repository.save(
      repository.create({
        ...input,
        scopeValue: input.scope === 'global' ? null : input.scopeValue?.trim(),
        warningPercent: input.warningPercent ?? 80,
        isActive: input.isActive ?? true,
        createdBy: adminId,
      }),
    );
    return this.toBudget(entity);
  }

  async updateBudget(
    id: string,
    input: Partial<UpsertAiUsageBudgetRequest>,
  ): Promise<AiUsageBudget> {
    const repository = this.requireBudgetRepository();
    const current = await repository.findOneBy({ id });
    if (!current) throw new NotFoundException('Không tìm thấy ngân sách AI');
    const scope = input.scope ?? current.scope;
    Object.assign(current, input, {
      scopeValue:
        scope === 'global'
          ? null
          : (input.scopeValue?.trim() ?? current.scopeValue),
    });
    return this.toBudget(await repository.save(current));
  }

  async deleteBudget(id: string): Promise<void> {
    const repository = this.requireBudgetRepository();
    const result = await repository.delete(id);
    if (!result.affected)
      throw new NotFoundException('Không tìm thấy ngân sách AI');
  }

  private filteredQuery(
    filters: AiUsageAnalyticsFilters,
    from: Date,
    to: Date,
  ): SelectQueryBuilder<AiUsageEventEntity> {
    const query = this.events
      .createQueryBuilder('event')
      .where('event.created_at >= :from AND event.created_at <= :to', {
        from,
        to,
      });
    if (filters.providerId)
      query.andWhere('event.provider_id = :providerId', {
        providerId: filters.providerId,
      });
    if (filters.model)
      query.andWhere('event.model = :model', { model: filters.model });
    if (filters.source)
      query.andWhere('event.source = :source', { source: filters.source });
    if (filters.status)
      query.andWhere('event.status = :status', { status: filters.status });
    if (filters.search?.trim()) {
      query.andWhere(
        `(event.provider_name ILIKE :search OR event.model ILIKE :search OR event.error_message ILIKE :search OR CAST(event.reference_id AS text) ILIKE :search OR CAST(event.user_id AS text) ILIKE :search)`,
        { search: `%${filters.search.trim()}%` },
      );
    }
    return query;
  }

  private async summary(
    filters: AiUsageAnalyticsFilters,
    from: Date,
    to: Date,
  ): Promise<AiUsageAnalyticsSummary> {
    const row = await this.filteredQuery(filters, from, to)
      .select('COUNT(*)', 'requests')
      .addSelect(
        `COUNT(*) FILTER (WHERE event.status = 'success')`,
        'successful_requests',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE event.status <> 'success')`,
        'failed_requests',
      )
      .addSelect('COALESCE(SUM(event.input_tokens), 0)', 'input_tokens')
      .addSelect('COALESCE(SUM(event.output_tokens), 0)', 'output_tokens')
      .addSelect(
        'COALESCE(SUM(event.cache_input_tokens), 0)',
        'cache_input_tokens',
      )
      .addSelect('COALESCE(SUM(event.cost_usd), 0)', 'cost_usd')
      .addSelect(
        'COUNT(*) FILTER (WHERE event.cost_usd IS NULL)',
        'unpriced_requests',
      )
      .addSelect('AVG(event.latency_ms)', 'average_latency_ms')
      .addSelect(
        'percentile_cont(0.95) WITHIN GROUP (ORDER BY event.latency_ms)',
        'p95_latency_ms',
      )
      .getRawOne<SummaryRawRow>();
    return mapSummary(row);
  }

  private async timeseries(
    filters: AiUsageAnalyticsFilters,
    from: Date,
    to: Date,
    granularity: 'hour' | 'day' | 'month',
  ) {
    const rows = await this.filteredQuery(filters, from, to)
      .select(`date_trunc('${granularity}', event.created_at)`, 'bucket')
      .addSelect('COUNT(*)', 'requests')
      .addSelect(
        `COUNT(*) FILTER (WHERE event.status <> 'success')`,
        'failed_requests',
      )
      .addSelect('COALESCE(SUM(event.input_tokens), 0)', 'input_tokens')
      .addSelect('COALESCE(SUM(event.output_tokens), 0)', 'output_tokens')
      .addSelect('COALESCE(SUM(event.cost_usd), 0)', 'cost_usd')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{
        bucket: Date | string;
        requests: string;
        failed_requests: string;
        input_tokens: string;
        output_tokens: string;
        cost_usd: string;
      }>();
    return rows.map((row) => ({
      bucket: new Date(row.bucket).toISOString(),
      requests: Number(row.requests),
      failedRequests: Number(row.failed_requests),
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      costUsd: Number(row.cost_usd),
    }));
  }

  private async breakdown(
    filters: AiUsageAnalyticsFilters,
    from: Date,
    to: Date,
    dimension: 'provider' | 'model' | 'source' | 'status',
  ): Promise<AiUsageBreakdownRow[]> {
    const dimensions = {
      provider: ['event.provider_id', 'event.provider_name'],
      model: ['event.model', 'event.model'],
      source: ['event.source', 'event.source'],
      status: ['event.status', 'event.status'],
    } as const;
    const [key, label] = dimensions[dimension];
    const rows = await this.filteredQuery(filters, from, to)
      .select(key, 'key')
      .addSelect(label, 'label')
      .addSelect('COUNT(*)', 'requests')
      .addSelect(
        `COUNT(*) FILTER (WHERE event.status <> 'success')`,
        'failed_requests',
      )
      .addSelect('COALESCE(SUM(event.input_tokens), 0)', 'input_tokens')
      .addSelect('COALESCE(SUM(event.output_tokens), 0)', 'output_tokens')
      .addSelect('COALESCE(SUM(event.cost_usd), 0)', 'cost_usd')
      .addSelect(
        'COUNT(*) FILTER (WHERE event.cost_usd IS NULL)',
        'unpriced_requests',
      )
      .addSelect('AVG(event.latency_ms)', 'average_latency_ms')
      .groupBy(key)
      .addGroupBy(label)
      .orderBy('cost_usd', 'DESC')
      .getRawMany<BreakdownRawRow>();
    return rows.map(mapBreakdown);
  }

  private async eventPage(
    filters: AiUsageAnalyticsFilters,
    from: Date,
    to: Date,
  ): Promise<{
    items: UsageEventGroupRawRow[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const pageSize = Math.min(
      5000,
      Math.max(1, filters.eventPageSize ?? filters.limit ?? 20),
    );
    const totalRaw = await this.filteredQuery(filters, from, to)
      .select(
        `COUNT(DISTINCT (COALESCE(CAST(event.reference_id AS text), CAST(event.id AS text)), event.provider_id, event.model, event.source, event.status))`,
        'total',
      )
      .getRawOne<{ total: string }>();
    const total = Number(totalRaw?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(totalPages, Math.max(1, filters.eventPage ?? 1));
    const groupKey =
      'COALESCE(CAST(event.reference_id AS text), CAST(event.id AS text))';
    const rows = await this.filteredQuery(filters, from, to)
      .select('MIN(CAST(event.id AS text))', 'id')
      .addSelect('COUNT(*)', 'request_count')
      .addSelect('event.provider_id', 'provider_id')
      .addSelect('event.provider_name', 'provider_name')
      .addSelect('event.model', 'model')
      .addSelect('event.source', 'source')
      .addSelect('event.status', 'status')
      .addSelect('event.reference_id', 'reference_id')
      .addSelect('event.user_id', 'user_id')
      .addSelect('SUM(event.input_tokens)', 'input_tokens')
      .addSelect('SUM(event.output_tokens)', 'output_tokens')
      .addSelect('SUM(event.cache_input_tokens)', 'cache_input_tokens')
      .addSelect(
        `CASE WHEN COUNT(*) FILTER (WHERE event.cost_usd IS NULL) > 0 THEN NULL ELSE SUM(event.cost_usd) END`,
        'cost_usd',
      )
      .addSelect('AVG(event.latency_ms)', 'latency_ms')
      .addSelect('MAX(event.http_status)', 'http_status')
      .addSelect('MAX(event.finish_reason)', 'finish_reason')
      .addSelect('MAX(event.error_code)', 'error_code')
      .addSelect('MAX(event.error_message)', 'error_message')
      .addSelect('MIN(event.created_at)', 'started_at')
      .addSelect('MAX(event.created_at)', 'created_at')
      .groupBy(groupKey)
      .addGroupBy('event.provider_id')
      .addGroupBy('event.provider_name')
      .addGroupBy('event.model')
      .addGroupBy('event.source')
      .addGroupBy('event.status')
      .addGroupBy('event.reference_id')
      .addGroupBy('event.user_id')
      .orderBy('created_at', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<UsageEventGroupRawRow>();
    return {
      items: rows,
      pagination: { page, pageSize, total, totalPages },
    };
  }

  private requireBudgetRepository(): Repository<AiUsageBudgetEntity> {
    if (!this.budgets)
      throw new Error('AiUsageBudget repository chưa được cấu hình');
    return this.budgets;
  }

  private async toBudget(entity: AiUsageBudgetEntity): Promise<AiUsageBudget> {
    const now = new Date();
    const from = budgetPeriodStart(entity.period, now);
    const query = this.events
      .createQueryBuilder('event')
      .select('COALESCE(SUM(event.cost_usd), 0)', 'spent')
      .where('event.created_at >= :from AND event.created_at <= :to', {
        from,
        to: now,
      });
    if (entity.scope === 'provider')
      query.andWhere('event.provider_id = :value', {
        value: entity.scopeValue,
      });
    if (entity.scope === 'model')
      query.andWhere('event.model = :value', { value: entity.scopeValue });
    if (entity.scope === 'source')
      query.andWhere('event.source = :value', { value: entity.scopeValue });
    const raw = await query.getRawOne<{ spent: string }>();
    const spentUsd = Number(raw?.spent ?? 0);
    const usagePercent =
      entity.limitUsd > 0 ? (spentUsd / entity.limitUsd) * 100 : 0;
    return {
      id: entity.id,
      name: entity.name,
      scope: entity.scope,
      scopeValue: entity.scopeValue,
      period: entity.period,
      limitUsd: entity.limitUsd,
      warningPercent: entity.warningPercent,
      isActive: entity.isActive,
      spentUsd,
      usagePercent,
      state:
        usagePercent >= 100
          ? 'exceeded'
          : usagePercent >= entity.warningPercent
            ? 'warning'
            : 'safe',
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}

function mapSummary(row?: SummaryRawRow): AiUsageAnalyticsSummary {
  const requests = Number(row?.requests ?? 0);
  const successfulRequests = Number(row?.successful_requests ?? 0);
  return {
    requests,
    successfulRequests,
    failedRequests: Number(row?.failed_requests ?? 0),
    successRate: requests ? (successfulRequests / requests) * 100 : 0,
    inputTokens: Number(row?.input_tokens ?? 0),
    outputTokens: Number(row?.output_tokens ?? 0),
    cacheInputTokens: Number(row?.cache_input_tokens ?? 0),
    costUsd: Number(row?.cost_usd ?? 0),
    unpricedRequests: Number(row?.unpriced_requests ?? 0),
    averageLatencyMs:
      row?.average_latency_ms == null ? null : Number(row.average_latency_ms),
    p95LatencyMs:
      row?.p95_latency_ms == null ? null : Number(row.p95_latency_ms),
  };
}

function mapBreakdown(row: BreakdownRawRow): AiUsageBreakdownRow {
  return {
    key: row.key,
    label: row.label,
    requests: Number(row.requests),
    failedRequests: Number(row.failed_requests),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    costUsd: Number(row.cost_usd),
    unpricedRequests: Number(row.unpriced_requests),
    averageLatencyMs:
      row.average_latency_ms === null ? null : Number(row.average_latency_ms),
  };
}

function toUsageEvent(row: UsageEventGroupRawRow): AiUsageEvent {
  return {
    id: row.id,
    requestCount: Number(row.request_count),
    providerId: row.provider_id,
    providerName: row.provider_name,
    model: row.model,
    source: row.source,
    status: row.status,
    referenceId: row.reference_id,
    userId: row.user_id,
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    cacheInputTokens: Number(row.cache_input_tokens),
    costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
    latencyMs: row.latency_ms === null ? null : Number(row.latency_ms),
    httpStatus: row.http_status === null ? null : Number(row.http_status),
    finishReason: row.finish_reason,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: new Date(row.started_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function chooseGranularity(from: Date, to: Date): 'hour' | 'day' | 'month' {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 2) return 'hour';
  if (days <= 93) return 'day';
  return 'month';
}

function budgetPeriodStart(period: 'daily' | 'monthly', now: Date): Date {
  return period === 'daily'
    ? new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      )
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function addBreakdownSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: AiUsageBreakdownRow[],
): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [
    { header: 'Tên', key: 'label', width: 35 },
    { header: 'Request', key: 'requests', width: 14 },
    { header: 'Request lỗi', key: 'failed', width: 14 },
    { header: 'Input token', key: 'input', width: 16 },
    { header: 'Output token', key: 'output', width: 16 },
    { header: 'Chi phí USD', key: 'cost', width: 16 },
    { header: 'Thiếu giá', key: 'unpriced', width: 14 },
    { header: 'Độ trễ TB ms', key: 'latency', width: 18 },
  ];
  rows.forEach((row) =>
    sheet.addRow({
      label: row.label,
      requests: row.requests,
      failed: row.failedRequests,
      input: row.inputTokens,
      output: row.outputTokens,
      cost: row.costUsd,
      unpriced: row.unpricedRequests,
      latency: row.averageLatencyMs ?? '',
    }),
  );
  styleWorksheet(sheet);
}

function styleWorksheet(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FF101828' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFD84D' },
  };
  header.alignment = { vertical: 'middle' };
  header.height = 24;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, sheet.columnCount) },
  };
}

function safeInteger(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

function truncate(value: string | null | undefined, length: number) {
  return value ? value.slice(0, length) : null;
}

/** Quy token ra USD theo đơn giá trên 1 triệu token. */
export function calculateUsageCostUsd(
  inputTokens: number,
  outputTokens: number,
  inputUsdPer1m: number | null,
  outputUsdPer1m: number | null,
): number | null {
  if (inputUsdPer1m === null || outputUsdPer1m === null) return null;
  return (
    (Math.max(0, inputTokens) * inputUsdPer1m) / 1_000_000 +
    (Math.max(0, outputTokens) * outputUsdPer1m) / 1_000_000
  );
}
