import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '@/modules/ai/entities/ai-usage-event.entity';
import { AiProviderDriver } from '@/modules/ai/ai-provider-driver';

export enum AiProviderKind {
  OLLAMA = 'ollama',
  OPENAI_COMPATIBLE = 'openai_compatible',
}

export enum AiProviderHealthStatus {
  UNKNOWN = 'unknown',
  ONLINE = 'online',
  OFFLINE = 'offline',
}

@Entity('ai_providers')
export class AiProviderEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_ai_providers',
  })
  id!: string;
  @Column({ type: 'varchar', length: 120, unique: true }) name!: string;
  @Column({ type: 'enum', enum: AiProviderKind }) kind!: AiProviderKind;
  /** SDK/contract kết nối. kind chỉ giữ tương thích cho URL policy cũ. */
  @Column({
    type: 'varchar',
    length: 32,
    default: AiProviderDriver.OPENAI_COMPATIBLE,
  })
  driver!: AiProviderDriver;
  @Column({ name: 'base_url', type: 'varchar', length: 500 }) baseUrl!: string;
  @Column({ type: 'varchar', length: 200 }) model!: string;
  @Column({ name: 'encrypted_api_key', type: 'text', nullable: true })
  encryptedApiKey!: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;
  @Column({ name: 'is_vision_default', type: 'boolean', default: false })
  isVisionDefault!: boolean;
  /** Provider nhanh/rẻ dùng cho phân tích chunk; rỗng thì dùng provider quiz. */
  @Column({ name: 'is_analysis_default', type: 'boolean', default: false })
  isAnalysisDefault!: boolean;
  @Column({ name: 'base_credit_cost', type: 'integer', default: 1 })
  baseCreditCost!: number;
  @Column({ name: 'credit_cost_per_1k_tokens', type: 'integer', default: 1 })
  creditCostPer1kTokens!: number;
  // Đơn giá USD trên 1 triệu token — NULL khi admin chưa cấu hình giá.
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
    name: 'health_status',
    type: 'varchar',
    length: 16,
    default: AiProviderHealthStatus.UNKNOWN,
  })
  healthStatus!: AiProviderHealthStatus;
  @Column({ name: 'last_health_latency_ms', type: 'integer', nullable: true })
  lastHealthLatencyMs!: number | null;
  @Column({
    name: 'last_health_checked_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastHealthCheckedAt!: Date | null;
  @Column({
    name: 'last_health_error',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  lastHealthError!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
