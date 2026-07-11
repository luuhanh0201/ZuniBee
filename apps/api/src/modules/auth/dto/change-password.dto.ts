import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import type { ChangePasswordRequest } from '@zunibee/shared';

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiPropertyOptional({
    description:
      'Bỏ trống nếu tài khoản chưa từng đặt mật khẩu (đăng ký qua Google/Facebook)',
  })
  @IsOptional()
  @IsString({ message: 'Mật khẩu hiện tại không hợp lệ' })
  currentPassword?: string;

  @ApiProperty({ minLength: 8 })
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  newPassword!: string;
}
