import { IsEnum } from 'class-validator';
import { UserRole, type AdminUpdateUserRoleRequest } from '@zunibee/shared';

export class UpdateUserRoleDto implements AdminUpdateUserRoleRequest {
  @IsEnum(UserRole, { message: 'Vai trò không hợp lệ' })
  role!: UserRole;
}
