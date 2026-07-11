import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import type { ForgotPasswordRequest } from '@zunibee/shared';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @ApiProperty({ example: 'hocsinh@vidu.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;
}
