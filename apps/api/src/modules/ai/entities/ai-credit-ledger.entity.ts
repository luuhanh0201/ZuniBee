import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AiCreditLedgerKind {
  GRANT = 'grant',
  RESERVE = 'reserve',
  CONSUME = 'consume',
  RELEASE = 'release',
}

@Entity('ai_credit_ledger')
export class AiCreditLedgerEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_ai_credit_ledger',
  })
  id!: string;
  @Column({ name: 'user_id', type: 'uuid' })
  @Index('IDX_ai_credit_ledger_user_id')
  userId!: string;
  @Column({ type: 'enum', enum: AiCreditLedgerKind }) kind!: AiCreditLedgerKind;
  @Column({ type: 'integer' }) amount!: number;
  @Column({ name: 'balance_after', type: 'integer' }) balanceAfter!: number;
  @Column({ name: 'reserved_after', type: 'integer' }) reservedAfter!: number;
  @Column({ name: 'reference_type', type: 'varchar', length: 60 })
  referenceType!: string;
  @Column({ name: 'reference_id', type: 'uuid' }) referenceId!: string;
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 180,
    unique: true,
  })
  idempotencyKey!: string;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy!:
    string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
