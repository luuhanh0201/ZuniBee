import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';
import { User } from '@/modules/user/entities/user.entity';

@Entity('classroom_members')
@Index('UQ_classroom_members_classroom_user', ['classroomId', 'userId'], {
  unique: true,
})
export class ClassroomMember {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_classroom_members',
  })
  id!: string;

  @Column({ name: 'classroom_id', type: 'uuid' })
  @Index('IDX_classroom_members_classroom_id')
  classroomId!: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.members, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'classroom_id',
    foreignKeyConstraintName: 'FK_classroom_members_classroom',
  })
  classroom!: Classroom;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('IDX_classroom_members_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_classroom_members_user',
  })
  user!: User;

  @Column({ name: 'joined_at', type: 'timestamptz', default: () => 'now()' })
  joinedAt!: Date;
}
