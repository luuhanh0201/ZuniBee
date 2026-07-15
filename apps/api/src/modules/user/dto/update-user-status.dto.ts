import { IsIn } from 'class-validator';
import { UserStatus, type AdminUpdateUserStatusRequest } from '@zunibee/shared';

export class UpdateUserStatusDto implements AdminUpdateUserStatusRequest {
  // INACTIVE để dành cho tương lai — admin chỉ khóa/mở.
  @IsIn([UserStatus.ACTIVE, UserStatus.BANNED], {
    message: 'Trạng thái chỉ nhận active hoặc banned',
  })
  status!: UserStatus.ACTIVE | UserStatus.BANNED;
}
