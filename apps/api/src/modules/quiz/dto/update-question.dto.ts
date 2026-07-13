import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { UpdateQuizQuestionRequest } from '@zunibee/shared';
import { QuizQuestionType } from '../entities/quiz-question.entity';
class UpdateOptionDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) content!: string;
  @IsBoolean() isCorrect!: boolean;
}
export class UpdateQuestionDto implements UpdateQuizQuestionRequest {
  @IsOptional()
  @IsEnum(QuizQuestionType, { message: 'Loại câu hỏi không hợp lệ' })
  type?: QuizQuestionType;
  @IsOptional()
  @IsString({ message: 'Nội dung câu hỏi phải là chuỗi' })
  @MinLength(1, { message: 'Câu hỏi không được để trống' })
  content?: string;
  @IsOptional()
  @IsString({ message: 'Giải thích phải là chuỗi' })
  explanation?: string | null;
  @IsOptional()
  @IsBoolean({ message: 'Cấu hình hiển thị giải thích không hợp lệ' })
  showExplanation?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: 'Cần ít nhất 2 lựa chọn' })
  @ValidateNested({ each: true })
  @Type(() => UpdateOptionDto)
  options?: UpdateOptionDto[];
}
