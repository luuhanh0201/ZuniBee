import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole, type SelectRoleRequest } from '@zunibee/shared';

export class SelectRoleDto implements SelectRoleRequest {
  @ApiProperty({ enum: [UserRole.STUDENT, UserRole.TEACHER] })
  @IsEnum([UserRole.STUDENT, UserRole.TEACHER], {
    message: 'Vai trò phải là học sinh hoặc giáo viên',
  })
  role!: UserRole.STUDENT | UserRole.TEACHER;
}
