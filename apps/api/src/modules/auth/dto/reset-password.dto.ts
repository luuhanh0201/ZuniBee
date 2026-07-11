import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { ResetPasswordRequest } from '@zunibee/shared';

export class ResetPasswordDto implements ResetPasswordRequest {
  @ApiProperty({ example: 'hocsinh@vidu.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @ApiProperty({ description: 'Mật khẩu tạm nhận được qua email' })
  @IsString({ message: 'Mật khẩu tạm không hợp lệ' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu tạm' })
  tempPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  newPassword!: string;
}
