import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuizQuestion } from './quiz-question.entity';

@Entity('quiz_question_options')
@Index(
  'UQ_quiz_question_options_question_order',
  ['questionId', 'displayOrder'],
  { unique: true },
)
export class QuizQuestionOption {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_quiz_question_options',
  })
  id!: string;
  @Column({ name: 'question_id', type: 'uuid' })
  @Index('IDX_quiz_question_options_question_id')
  questionId!: string;
  @ManyToOne(() => QuizQuestion, (question) => question.options, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'question_id',
    foreignKeyConstraintName: 'FK_quiz_question_options_question',
  })
  question!: QuizQuestion;
  @Column({ type: 'text' }) content!: string;
  @Column({ name: 'is_correct', type: 'boolean', default: false })
  isCorrect!: boolean;
  @Column({ name: 'display_order', type: 'integer' }) displayOrder!: number;
}
