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
import type {
  CreateQuizQuestionRequest,
  QuizQuestionOptionInput,
} from '@zunibee/shared';
import { QuizQuestionType } from '../entities/quiz-question.entity';
class QuizQuestionOptionDto implements QuizQuestionOptionInput {
  @IsString({ message: 'Nội dung lựa chọn phải là chuỗi' })
  @MinLength(1, { message: 'Lựa chọn không được để trống' })
  @MaxLength(1000, { message: 'Lựa chọn tối đa 1000 ký tự' })
  content!: string;
  @IsBoolean({ message: 'Trạng thái đáp án đúng không hợp lệ' })
  isCorrect!: boolean;
}
export class CreateQuestionDto implements CreateQuizQuestionRequest {
  @IsEnum(QuizQuestionType, { message: 'Loại câu hỏi không hợp lệ' })
  type!: QuizQuestionType;
  @IsString({ message: 'Nội dung câu hỏi phải là chuỗi' })
  @MinLength(1, { message: 'Câu hỏi không được để trống' })
  @MaxLength(10_000, { message: 'Câu hỏi tối đa 10000 ký tự' })
  content!: string;
  @IsOptional()
  @IsString({ message: 'Giải thích phải là chuỗi' })
  @MaxLength(5000, { message: 'Giải thích quá dài' })
  explanation?: string | null;
  @IsOptional()
  @IsBoolean({ message: 'Cấu hình hiển thị giải thích không hợp lệ' })
  showExplanation?: boolean;
  @IsArray({ message: 'Danh sách lựa chọn không hợp lệ' })
  @ArrayMinSize(2, { message: 'Cần ít nhất 2 lựa chọn' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 lựa chọn' })
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionOptionDto)
  options!: QuizQuestionOptionDto[];
}
