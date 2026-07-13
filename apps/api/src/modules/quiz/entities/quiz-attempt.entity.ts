import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';
import { User } from '@/modules/user/entities/user.entity';
import { QuizAttemptAnswer } from './quiz-attempt-answer.entity';

export enum QuizAttemptStatus {
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  EXPIRED = 'expired',
}

@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_quiz_attempts',
  })
  id!: string;
  @Column({ name: 'quiz_id', type: 'uuid' })
  @Index('IDX_quiz_attempts_quiz_id')
  quizId!: string;
  @ManyToOne(() => Quiz, (quiz) => quiz.attempts, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'quiz_id',
    foreignKeyConstraintName: 'FK_quiz_attempts_quiz',
  })
  quiz!: Quiz;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId!:
    string | null;
  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_quiz_attempts_user',
  })
  user!: User | null;
  @Column({ name: 'guest_token', type: 'varchar', length: 64, nullable: true })
  guestToken!: string | null;
  @Column({ name: 'guest_name', type: 'varchar', length: 120, nullable: true })
  guestName!: string | null;
  @Column({ name: 'attempt_number', type: 'integer' }) attemptNumber!: number;
  @Column({
    type: 'enum',
    enum: QuizAttemptStatus,
    default: QuizAttemptStatus.IN_PROGRESS,
  })
  status!: QuizAttemptStatus;
  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) score!:
    string | null;
  @Column({ name: 'max_score', type: 'numeric', precision: 10, scale: 2 })
  maxScore!: string;
  @Column({ name: 'time_taken_seconds', type: 'integer', nullable: true })
  timeTakenSeconds!: number | null;
  @OneToMany(() => QuizAttemptAnswer, (answer) => answer.attempt)
  answers!: QuizAttemptAnswer[];
}
