import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateQuizRequest } from '@zunibee/shared';
export class CreateQuizDto implements CreateQuizRequest {
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @MinLength(1, { message: 'Tiêu đề không được để trống' })
  @MaxLength(200, { message: 'Tiêu đề tối đa 200 ký tự' })
  title!: string;
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  description?: string;
}
