import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { LoginRequest } from '@zunibee/shared';
import { MaxByteLength } from '@/common/validation/max-byte-length.decorator';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'hocsinh@vidu.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;

  @ApiProperty()
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu' })
  @MaxByteLength(72, { message: 'Mật khẩu tối đa 72 byte UTF-8' })
  password!: string;
}
