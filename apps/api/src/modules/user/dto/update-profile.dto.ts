import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import type { UpdateProfileRequest } from '@zunibee/shared';

export class UpdateProfileDto implements UpdateProfileRequest {
  @IsString()
  @Length(2, 100, { message: 'Họ và tên phải có từ 2 đến 100 ký tự' })
  fullName!: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @Matches(/^\+?[0-9][0-9 .-]{7,19}$/, {
    message: 'Số điện thoại không đúng định dạng',
  })
  @IsOptional()
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Đường dẫn ảnh đại diện không hợp lệ' },
  )
  @IsOptional()
  avatar?: string | null;
}
