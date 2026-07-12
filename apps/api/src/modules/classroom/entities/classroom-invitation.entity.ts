import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';

export enum ClassroomInvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity('classroom_invitations')
@Index('UQ_classroom_invitations_pending_email', ['classroomId', 'email'], {
  unique: true,
  where: `status = 'pending'`,
})
@Index('UQ_classroom_invitations_token_hash', ['tokenHash'], { unique: true })
@Check(
  'CHK_classroom_invitations_email_normalized',
  `"email" = lower(btrim("email"))`,
)
export class ClassroomInvitation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_classroom_invitations',
  })
  id!: string;

  @Column({ name: 'classroom_id', type: 'uuid' })
  @Index('IDX_classroom_invitations_classroom_id')
  classroomId!: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.invitations, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'classroom_id',
    foreignKeyConstraintName: 'FK_classroom_invitations_classroom',
  })
  classroom!: Classroom;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash!: string;

  @Column({
    type: 'enum',
    enum: ClassroomInvitationStatus,
    default: ClassroomInvitationStatus.PENDING,
  })
  status!: ClassroomInvitationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
