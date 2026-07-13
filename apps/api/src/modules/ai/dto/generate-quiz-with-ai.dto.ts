import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type {
  AiGenerationSourceType,
  GenerateQuizWithAiRequest,
} from '@zunibee/shared';
import { QuizQuestionType } from '@/modules/quiz/entities/quiz-question.entity';

export class GenerateQuizWithAiDto implements GenerateQuizWithAiRequest {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MinLength(2) @MaxLength(500) topic!: string;
  @IsOptional() @IsString() @MaxLength(80) language?: string;
  @IsOptional() @IsIn(['easy', 'medium', 'hard']) difficulty?:
    'easy' | 'medium' | 'hard';
  @IsInt() @Min(1) @Max(50) questionCount!: number;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStringArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(QuizQuestionType, {
    each: true,
    message: 'Loại câu hỏi không hợp lệ',
  })
  questionTypes?: QuizQuestionType[];
  @IsOptional()
  @IsIn(['prompt', 'upload'])
  sourceType?: AiGenerationSourceType;
}

function toStringArray(value: unknown): string[] {
  let candidate: unknown = value;
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      candidate = value;
    }
  }
  const items: unknown[] = Array.isArray(candidate)
    ? (candidate as unknown[])
    : [candidate];
  return items.filter((item): item is string => typeof item === 'string');
}
