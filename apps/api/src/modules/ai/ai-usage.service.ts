import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  AiUsageSource,
  AiUsageStatRow,
  AiUsageStats,
} from '@zunibee/shared';
import { AiUsageEventEntity } from '@/modules/ai/entities/ai-usage-event.entity';
import type { AiProviderEntity } from '@/modules/ai/entities/ai-provider.entity';

export type RecordAiUsageInput = {
  provider: AiProviderEntity;
  source: AiUsageSource;
  referenceId: string | null;
  userId: string | null;
  inputTokens: number;
  outputTokens: number;
};

type UsageStatRawRow = {
  provider_id: string;
  provider_name: string;
  model: string;
  requests: string;
  input_tokens: string;
  output_tokens: string;
  cost_usd: string | null;
  unpriced_requests: string;
};

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    @InjectRepository(AiUsageEventEntity)
    private readonly events: Repository<AiUsageEventEntity>,
  ) {}

  /** Snapshot model + đơn giá của provider tại thời điểm gọi vào event. */
  async record(input: RecordAiUsageInput): Promise<void> {
    await this.events.save(
      this.events.create({
        providerId: input.provider.id,
        providerName: input.provider.name,
        model: input.provider.model,
        source: input.source,
        referenceId: input.referenceId,
        userId: input.userId,
        inputTokens: Math.max(0, Math.floor(input.inputTokens)),
        outputTokens: Math.max(0, Math.floor(input.outputTokens)),
        inputUsdPer1m: input.provider.inputUsdPer1m,
        outputUsdPer1m: input.provider.outputUsdPer1m,
        costUsd: calculateUsageCostUsd(
          input.inputTokens,
          input.outputTokens,
          input.provider.inputUsdPer1m,
          input.provider.outputUsdPer1m,
        ),
      }),
    );
  }

  /** Như record() nhưng không bao giờ throw — thống kê lỗi không được làm fail request AI. */
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

  async stats(from: Date, to: Date): Promise<AiUsageStats> {
    const raw = await this.events
      .createQueryBuilder('event')
      .select('event.provider_id', 'provider_id')
      .addSelect('event.provider_name', 'provider_name')
      .addSelect('event.model', 'model')
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
      .getRawMany<UsageStatRawRow>();

    const rows: AiUsageStatRow[] = raw
      .map((row) => ({
        providerId: row.provider_id,
        providerName: row.provider_name,
        model: row.model,
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
}

/**
 * Quy token ra USD theo đơn giá trên 1 triệu token. Trả null khi thiếu giá ở
 * bất kỳ chiều nào — thà không hiển thị còn hơn hiển thị số tiền thiếu.
 */
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
