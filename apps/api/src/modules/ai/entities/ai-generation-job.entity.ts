import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AiGenerationJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

@Entity('ai_generation_jobs')
export class AiGenerationJobEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_ai_generation_jobs',
  })
  id!: string;
  @Column({ name: 'teacher_id', type: 'uuid' })
  @Index('IDX_ai_generation_jobs_teacher_id')
  teacherId!: string;
  @Column({ name: 'provider_id', type: 'uuid' }) providerId!: string;
  @Column({ name: 'quiz_id', type: 'uuid', nullable: true }) quizId!:
    string | null;
  @Column({
    type: 'enum',
    enum: AiGenerationJobStatus,
    default: AiGenerationJobStatus.PENDING,
  })
  status!: AiGenerationJobStatus;
  @Column({ name: 'request_payload', type: 'jsonb' }) requestPayload!: Record<
    string,
    unknown
  >;
  @Column({ name: 'reserved_credits', type: 'integer' })
  reservedCredits!: number;
  @Column({ name: 'charged_credits', type: 'integer', default: 0 })
  chargedCredits!: number;
  @Column({ name: 'input_tokens', type: 'integer', default: 0 })
  inputTokens!: number;
  @Column({ name: 'output_tokens', type: 'integer', default: 0 })
  outputTokens!: number;
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
