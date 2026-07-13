import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AiGenerationJobStatus } from './ai-generation-job.entity';

@Entity('quiz_weakness_insights')
export class QuizWeaknessInsightEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_quiz_weakness_insights',
  })
  id!: string;
  @Column({ name: 'quiz_id', type: 'uuid' })
  @Index('IDX_quiz_weakness_insights_quiz_id')
  quizId!: string;
  @Column({ name: 'teacher_id', type: 'uuid' }) teacherId!: string;
  @Column({ name: 'provider_id', type: 'uuid' }) providerId!: string;
  @Column({
    type: 'enum',
    enum: AiGenerationJobStatus,
    default: AiGenerationJobStatus.PENDING,
  })
  status!: AiGenerationJobStatus;
  @Column({ type: 'text', nullable: true }) summary!: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) strengths!: string[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  weaknesses!: string[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  recommendations!: string[];
  @Column({ name: 'sample_size', type: 'integer', default: 0 })
  sampleSize!: number;
  @Column({ name: 'reserved_credits', type: 'integer', default: 0 })
  reservedCredits!: number;
  @Column({ name: 'charged_credits', type: 'integer', default: 0 })
  chargedCredits!: number;
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;
  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
