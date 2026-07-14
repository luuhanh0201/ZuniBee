import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';
import type { ForgotPasswordRequest } from '@zunibee/shared';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @ApiProperty({ example: 'hocsinh@vidu.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;
}
