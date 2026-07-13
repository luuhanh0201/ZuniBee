import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { StartQuizAttemptRequest } from '@zunibee/shared';
export class StartAttemptDto implements StartQuizAttemptRequest {
  @IsUUID('4', { message: 'ID quiz không hợp lệ' }) quizId!: string;
  @IsOptional()
  @IsString()
  @Length(16, 64, { message: 'Mã khách phải dài từ 16 đến 64 ký tự' })
  guestToken?: string;
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Tên khách không được để trống' })
  @MaxLength(120, { message: 'Tên khách tối đa 120 ký tự' })
  guestName?: string;
}
