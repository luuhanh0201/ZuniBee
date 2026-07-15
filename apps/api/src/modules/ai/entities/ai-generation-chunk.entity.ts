import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AiGenerationChunkStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('ai_generation_chunks')
@Index('IDX_ai_generation_chunks_job', ['jobId'])
export class AiGenerationChunkEntity {
  @PrimaryColumn({ name: 'job_id', type: 'uuid' }) jobId!: string;
  @PrimaryColumn({ name: 'chunk_index', type: 'integer' }) chunkIndex!: number;
  @Column({ name: 'start_page', type: 'integer', nullable: true })
  startPage!: number | null;
  @Column({ name: 'end_page', type: 'integer', nullable: true })
  endPage!: number | null;
  @Column({ type: 'text' }) text!: string;
  @Column({ type: 'jsonb', nullable: true })
  analysis!: Record<string, unknown> | null;
  @Column({ name: 'analysis_input_tokens', type: 'integer', default: 0 })
  analysisInputTokens!: number;
  @Column({ name: 'analysis_output_tokens', type: 'integer', default: 0 })
  analysisOutputTokens!: number;
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: AiGenerationChunkStatus;
  @Column({ name: 'candidate_questions', type: 'jsonb', nullable: true })
  candidateQuestions!: unknown[] | null;
  @Column({ name: 'input_tokens', type: 'integer', default: 0 })
  inputTokens!: number;
  @Column({ name: 'output_tokens', type: 'integer', default: 0 })
  outputTokens!: number;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
