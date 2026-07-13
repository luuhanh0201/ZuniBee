import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';
import { User } from '@/modules/user/entities/user.entity';

export enum QuizAssignmentTargetType {
  CLASSROOM = 'classroom',
  STUDENT = 'student',
}

@Entity('quiz_assignments')
export class QuizAssignment {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_quiz_assignments',
  })
  id!: string;
  @Column({ name: 'quiz_id', type: 'uuid' })
  @Index('IDX_quiz_assignments_quiz_id')
  quizId!: string;
  @ManyToOne(() => Quiz, (quiz) => quiz.assignments, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'quiz_id',
    foreignKeyConstraintName: 'FK_quiz_assignments_quiz',
  })
  quiz!: Quiz;
  @Column({ name: 'target_type', type: 'enum', enum: QuizAssignmentTargetType })
  targetType!: QuizAssignmentTargetType;
  @Column({ name: 'classroom_id', type: 'uuid', nullable: true }) classroomId!:
    string | null;
  @ManyToOne(() => Classroom, {
    nullable: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'classroom_id',
    foreignKeyConstraintName: 'FK_quiz_assignments_classroom',
  })
  classroom!: Classroom | null;
  @Column({ name: 'student_id', type: 'uuid', nullable: true }) studentId!:
    string | null;
  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'student_id',
    foreignKeyConstraintName: 'FK_quiz_assignments_student',
  })
  student!: User | null;
  @Column({ name: 'assigned_by', type: 'uuid' }) assignedBy!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'assigned_by',
    foreignKeyConstraintName: 'FK_quiz_assignments_assigner',
  })
  assigner!: User;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
