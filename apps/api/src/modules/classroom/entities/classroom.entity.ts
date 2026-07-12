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
import { ClassroomMember } from '@/modules/classroom/entities/classroom-member.entity';
import { ClassroomInvitation } from '@/modules/classroom/entities/classroom-invitation.entity';
import { ClassroomMaterial } from '@/modules/classroom/entities/classroom-material.entity';

export enum ClassroomStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

@Entity('classrooms')
@Index('UQ_classrooms_join_code', ['joinCode'], { unique: true })
@Index('UQ_classrooms_join_token', ['joinToken'], { unique: true })
export class Classroom {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_classrooms',
  })
  id!: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  @Index('IDX_classrooms_teacher_id')
  teacherId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'teacher_id',
    foreignKeyConstraintName: 'FK_classrooms_teacher',
  })
  teacher!: User;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  subject!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  grade!: string | null;

  @Column({
    type: 'enum',
    enum: ClassroomStatus,
    default: ClassroomStatus.ACTIVE,
  })
  status!: ClassroomStatus;

  @Column({ name: 'join_code', type: 'varchar', length: 9 })
  joinCode!: string;

  @Column({ name: 'join_token', type: 'varchar', length: 64 })
  joinToken!: string;

  @OneToMany(() => ClassroomMember, (member) => member.classroom)
  members!: ClassroomMember[];

  @OneToMany(() => ClassroomInvitation, (invitation) => invitation.classroom)
  invitations!: ClassroomInvitation[];

  @OneToMany(() => ClassroomMaterial, (material) => material.classroom)
  materials!: ClassroomMaterial[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
