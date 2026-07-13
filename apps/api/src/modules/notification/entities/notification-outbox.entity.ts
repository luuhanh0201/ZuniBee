import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NotificationOutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('notification_outbox')
export class NotificationOutboxEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_notification_outbox',
  })
  id!: string;
  @Column({ type: 'varchar', length: 80 }) type!: string;
  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId!: string | null;
  @Column({ name: 'recipient_email', type: 'varchar', length: 320 })
  recipientEmail!: string;
  @Column({ type: 'jsonb' }) payload!: Record<string, unknown>;
  @Column({
    type: 'enum',
    enum: NotificationOutboxStatus,
    default: NotificationOutboxStatus.PENDING,
  })
  @Index('IDX_notification_outbox_status')
  status!: NotificationOutboxStatus;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ name: 'max_attempts', type: 'integer', default: 5 })
  maxAttempts!: number;
  @Column({ name: 'dedupe_key', type: 'varchar', length: 240, unique: true })
  dedupeKey!: string;
  @Column({ name: 'last_error', type: 'text', nullable: true }) lastError!:
    string | null;
  @Column({ name: 'available_at', type: 'timestamptz', default: () => 'now()' })
  availableAt!: Date;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
