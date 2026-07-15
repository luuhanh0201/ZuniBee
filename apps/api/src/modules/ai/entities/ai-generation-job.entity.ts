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

export enum AiGenerationJobStage {
  QUEUED = 'queued',
  READING_DOCUMENT = 'reading_document',
  ANALYZING_DOCUMENT = 'analyzing_document',
  PLANNING_QUIZ = 'planning_quiz',
  GENERATING_CANDIDATES = 'generating_candidates',
  SELECTING_QUESTIONS = 'selecting_questions',
  REVIEWING_QUESTIONS = 'reviewing_questions',
  GENERATING_QUIZ = 'generating_quiz',
  SAVING_QUIZ = 'saving_quiz',
  COMPLETED = 'completed',
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
  @Column({ name: 'vision_provider_id', type: 'uuid', nullable: true })
  visionProviderId!: string | null;
  @Column({ name: 'quiz_id', type: 'uuid', nullable: true }) quizId!:
    string | null;
  @Column({
    type: 'enum',
    enum: AiGenerationJobStatus,
    default: AiGenerationJobStatus.PENDING,
  })
  status!: AiGenerationJobStatus;
  @Column({
    type: 'varchar',
    length: 30,
    default: AiGenerationJobStage.QUEUED,
  })
  stage!: AiGenerationJobStage;
  @Column({ name: 'document_total_pages', type: 'integer', nullable: true })
  documentTotalPages!: number | null;
  @Column({ name: 'document_processed_pages', type: 'integer', default: 0 })
  documentProcessedPages!: number;
  @Column({ name: 'generation_total_chunks', type: 'integer', nullable: true })
  generationTotalChunks!: number | null;
  @Column({ name: 'generation_processed_chunks', type: 'integer', default: 0 })
  generationProcessedChunks!: number;
  @Column({
    name: 'source_storage_key',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  sourceStorageKey!: string | null;
  @Column({
    name: 'source_original_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  sourceOriginalName!: string | null;
  @Column({
    name: 'source_mime_type',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  sourceMimeType!: string | null;
  @Column({ name: 'source_size', type: 'integer', nullable: true })
  sourceSize!: number | null;
  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;
  @Column({ name: 'quiz_blueprint', type: 'jsonb', nullable: true })
  quizBlueprint!: Record<string, unknown> | null;
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
