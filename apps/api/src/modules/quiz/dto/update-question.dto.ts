import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { UpdateQuizQuestionRequest } from '@zunibee/shared';
import { QuizQuestionType } from '../entities/quiz-question.entity';
class UpdateOptionDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) @MaxLength(1000) content!: string;
  @IsBoolean() isCorrect!: boolean;
}
export class UpdateQuestionDto implements UpdateQuizQuestionRequest {
  @IsOptional()
  @IsEnum(QuizQuestionType, { message: 'Loại câu hỏi không hợp lệ' })
  type?: QuizQuestionType;
  @IsOptional()
  @IsString({ message: 'Nội dung câu hỏi phải là chuỗi' })
  @MinLength(1, { message: 'Câu hỏi không được để trống' })
  @MaxLength(10_000, { message: 'Câu hỏi tối đa 10000 ký tự' })
  content?: string;
  @IsOptional()
  @IsString({ message: 'Giải thích phải là chuỗi' })
  @MaxLength(5000, { message: 'Giải thích tối đa 5000 ký tự' })
  explanation?: string | null;
  @IsOptional()
  @IsBoolean({ message: 'Cấu hình hiển thị giải thích không hợp lệ' })
  showExplanation?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: 'Cần ít nhất 2 lựa chọn' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 lựa chọn' })
  @ValidateNested({ each: true })
  @Type(() => UpdateOptionDto)
  options?: UpdateOptionDto[];
}
