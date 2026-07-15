import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AiUsageBudgetPeriod, AiUsageBudgetScope } from '@zunibee/shared';
import { numericTransformer } from './ai-usage-event.entity';

@Entity('ai_usage_budgets')
export class AiUsageBudgetEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_ai_usage_budgets',
  })
  id!: string;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 20 }) scope!: AiUsageBudgetScope;
  @Column({ name: 'scope_value', type: 'varchar', length: 200, nullable: true })
  scopeValue!: string | null;
  @Column({ type: 'varchar', length: 20 }) period!: AiUsageBudgetPeriod;
  @Column({
    name: 'limit_usd',
    type: 'numeric',
    precision: 14,
    scale: 4,
    transformer: numericTransformer,
  })
  limitUsd!: number;
  @Column({ name: 'warning_percent', type: 'integer', default: 80 })
  warningPercent!: number;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
