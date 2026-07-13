import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@/modules/user/entities/user.entity';
import { QuizQuestion } from './quiz-question.entity';
import { QuizAssignment } from './quiz-assignment.entity';
import { QuizAttempt } from './quiz-attempt.entity';

export enum QuizStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}
export enum QuizVisibility {
  PRIVATE_CLASS = 'private_class',
  ASSIGNED = 'assigned',
  PUBLIC = 'public',
}
export enum QuizLeaderboardMode {
  HIDDEN = 'hidden',
  VISIBLE_ANONYMIZED = 'visible_anonymized',
}

@Entity('quizzes')
export class Quiz {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_quizzes' })
  id!: string;
  @Column({ name: 'teacher_id', type: 'uuid' })
  @Index('IDX_quizzes_teacher_id')
  teacherId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'teacher_id',
    foreignKeyConstraintName: 'FK_quizzes_teacher',
  })
  teacher!: User;
  @Column({ type: 'varchar', length: 200 }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'enum', enum: QuizStatus, default: QuizStatus.DRAFT })
  status!: QuizStatus;
  @Column({ name: 'total_score', type: 'smallint', default: 10 })
  totalScore!: number;
  @Column({ name: 'time_limit_seconds', type: 'integer', nullable: true })
  timeLimitSeconds!: number | null;
  @Column({ name: 'opens_at', type: 'timestamptz', nullable: true })
  opensAt!: Date | null;
  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt!: Date | null;
  @Column({ name: 'max_attempts', type: 'integer', nullable: true })
  maxAttempts!: number | null;
  @Column({
    type: 'enum',
    enum: QuizVisibility,
    default: QuizVisibility.PRIVATE_CLASS,
  })
  @Index('IDX_quizzes_visibility')
  visibility!: QuizVisibility;
  @Column({
    name: 'leaderboard_mode',
    type: 'enum',
    enum: QuizLeaderboardMode,
    default: QuizLeaderboardMode.HIDDEN,
  })
  leaderboardMode!: QuizLeaderboardMode;
  @Column({ name: 'answers_changed_at', type: 'timestamptz', nullable: true })
  answersChangedAt!: Date | null;
  @Column({ name: 'last_regraded_at', type: 'timestamptz', nullable: true })
  lastRegradedAt!: Date | null;
  @OneToMany(() => QuizQuestion, (question) => question.quiz)
  questions!: QuizQuestion[];
  @OneToMany(() => QuizAssignment, (assignment) => assignment.quiz)
  assignments!: QuizAssignment[];
  @OneToMany(() => QuizAttempt, (attempt) => attempt.quiz)
  attempts!: QuizAttempt[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
