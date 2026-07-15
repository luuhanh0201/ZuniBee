import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AiUsageSource, AiUsageStatus } from '@zunibee/shared';

/** Postgres trả numeric/bigint dạng string — convert về number khi đọc. */
export const numericTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};

/**
 * Mỗi lần gọi AI ghi 1 event, kể cả lỗi/refusal/timeout. Model + đơn giá được
 * snapshot tại thời điểm gọi để thống kê lịch sử không bị đổi theo provider.
 */
@Entity('ai_usage_events')
@Index('IDX_ai_usage_events_provider_model_created_at', [
  'providerId',
  'model',
  'createdAt',
])
export class AiUsageEventEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_ai_usage_events',
  })
  id!: string;
  @Column({ name: 'provider_id', type: 'uuid' }) providerId!: string;
  @Column({ name: 'provider_name', type: 'varchar', length: 120 })
  providerName!: string;
  @Column({ type: 'varchar', length: 200 }) model!: string;
  @Column({ type: 'varchar', length: 40 }) source!: AiUsageSource;
  @Column({ type: 'varchar', length: 30, default: 'success' })
  status!: AiUsageStatus;
  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId!: string | null;
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;
  @Column({
    name: 'input_tokens',
    type: 'bigint',
    default: 0,
    transformer: numericTransformer,
  })
  inputTokens!: number;
  @Column({
    name: 'output_tokens',
    type: 'bigint',
    default: 0,
    transformer: numericTransformer,
  })
  outputTokens!: number;
  @Column({
    name: 'cache_input_tokens',
    type: 'bigint',
    default: 0,
    transformer: numericTransformer,
  })
  cacheInputTokens!: number;
  @Column({
    name: 'input_usd_per_1m',
    type: 'numeric',
    precision: 12,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  inputUsdPer1m!: number | null;
  @Column({
    name: 'output_usd_per_1m',
    type: 'numeric',
    precision: 12,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  outputUsdPer1m!: number | null;
  @Column({
    name: 'cost_usd',
    type: 'numeric',
    precision: 14,
    scale: 8,
    nullable: true,
    transformer: numericTransformer,
  })
  costUsd!: number | null;
  @Column({ name: 'latency_ms', type: 'integer', nullable: true })
  latencyMs!: number | null;
  @Column({ name: 'http_status', type: 'integer', nullable: true })
  httpStatus!: number | null;
  @Column({
    name: 'finish_reason',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  finishReason!: string | null;
  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true })
  errorCode!: string | null;
  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errorMessage!: string | null;
  @Index('IDX_ai_usage_events_created_at')
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
