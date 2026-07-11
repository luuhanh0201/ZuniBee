import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { LoginRequest } from '@zunibee/shared';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'hocsinh@vidu.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @ApiProperty()
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu' })
  password!: string;
}
