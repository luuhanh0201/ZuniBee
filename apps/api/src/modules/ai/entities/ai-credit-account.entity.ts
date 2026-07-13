import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@/modules/user/entities/user.entity';

@Entity('ai_credit_accounts')
export class AiCreditAccountEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_ai_credit_accounts',
  })
  userId!: string;
  @OneToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_ai_credit_accounts_user',
  })
  user!: User;
  @Column({ type: 'integer', default: 0 }) balance!: number;
  @Column({ type: 'integer', default: 0 }) reserved!: number;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
