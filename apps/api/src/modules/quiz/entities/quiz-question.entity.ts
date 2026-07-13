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
import { QuizQuestionOption } from './quiz-question-option.entity';

export enum QuizQuestionType {
  SINGLE_CHOICE = 'single_choice',
  TRUE_FALSE = 'true_false',
  MULTIPLE_CHOICE = 'multiple_choice',
}

@Entity('quiz_questions')
@Index('UQ_quiz_questions_quiz_order', ['quizId', 'displayOrder'], {
  unique: true,
})
export class QuizQuestion {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_quiz_questions',
  })
  id!: string;
  @Column({ name: 'quiz_id', type: 'uuid' })
  @Index('IDX_quiz_questions_quiz_id')
  quizId!: string;
  @ManyToOne(() => Quiz, (quiz) => quiz.questions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'quiz_id',
    foreignKeyConstraintName: 'FK_quiz_questions_quiz',
  })
  quiz!: Quiz;
  @Column({ type: 'enum', enum: QuizQuestionType }) type!: QuizQuestionType;
  @Column({ type: 'text' }) content!: string;
  @Column({ type: 'text', nullable: true }) explanation!: string | null;
  @Column({ name: 'show_explanation', type: 'boolean', default: true })
  showExplanation!: boolean;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  score!: string;
  @Column({ name: 'display_order', type: 'integer' }) displayOrder!: number;
  @OneToMany(() => QuizQuestionOption, (option) => option.question)
  options!: QuizQuestionOption[];
}
