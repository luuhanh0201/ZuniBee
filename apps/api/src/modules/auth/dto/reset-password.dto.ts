import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { ResetPasswordRequest } from '@zunibee/shared';
import { MaxByteLength } from '@/common/validation/max-byte-length.decorator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @ApiProperty({ example: 'hocsinh@vidu.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;

  @ApiProperty({ description: 'Mật khẩu tạm nhận được qua email' })
  @IsString({ message: 'Mật khẩu tạm không hợp lệ' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu tạm' })
  @MaxByteLength(72)
  tempPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @MaxByteLength(72, { message: 'Mật khẩu mới tối đa 72 byte UTF-8' })
  newPassword!: string;
}
