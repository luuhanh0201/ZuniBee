import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuizAttempt } from './quiz-attempt.entity';
import { QuizQuestion } from './quiz-question.entity';

@Entity('quiz_attempt_answers')
@Index(
  'UQ_quiz_attempt_answers_attempt_question',
  ['attemptId', 'questionId'],
  { unique: true },
)
export class QuizAttemptAnswer {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_quiz_attempt_answers',
  })
  id!: string;
  @Column({ name: 'attempt_id', type: 'uuid' }) attemptId!: string;
  @ManyToOne(() => QuizAttempt, (attempt) => attempt.answers, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'attempt_id',
    foreignKeyConstraintName: 'FK_quiz_attempt_answers_attempt',
  })
  attempt!: QuizAttempt;
  @Column({ name: 'question_id', type: 'uuid' })
  @Index('IDX_quiz_attempt_answers_question_id')
  questionId!: string;
  @ManyToOne(() => QuizQuestion, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'question_id',
    foreignKeyConstraintName: 'FK_quiz_attempt_answers_question',
  })
  question!: QuizQuestion;
  @Column({
    name: 'selected_option_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  selectedOptionIds!: string[];
  @Column({ name: 'is_correct', type: 'boolean', nullable: true }) isCorrect!:
    boolean | null;
  @Column({
    name: 'score_awarded',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  scoreAwarded!: string;
  @Column({ name: 'answered_at', type: 'timestamptz', default: () => 'now()' })
  answeredAt!: Date;
}
