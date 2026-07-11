import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, UserStatus } from '@zunibee/shared';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  email!: string | null;

  @Column({ name: 'password_hash', nullable: true })
  passwordHash?: string;

  @Column({ name: 'full_name', nullable: false })
  fullName!: string;

  @Column({ name: 'phone', nullable: true })
  phone?: string;

  @Column({ name: 'avatar', nullable: true })
  avatar?: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  role!: UserRole;

  @Column({
    name: 'status',
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @Column({
    name: 'last_login_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastLoginAt!: Date | null;

  @Column({ name: 'is_verify', type: 'boolean', default: false })
  isVerify!: boolean;

  @Column({ name: 'verify_token', type: 'varchar', nullable: true })
  verifyToken?: string;

  /** Thời điểm mật khẩu tạm (quên mật khẩu) hết hiệu lực; null nếu không có yêu cầu đang chờ. */
  @Column({
    name: 'password_reset_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  passwordResetExpiresAt?: Date | null;

  @Column({ name: 'google_id', nullable: true, unique: true })
  googleId?: string;

  @Column({ name: 'facebook_id', nullable: true, unique: true })
  facebookId?: string;

  @Column({ name: 'provider', type: 'varchar', nullable: true })
  provider?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
