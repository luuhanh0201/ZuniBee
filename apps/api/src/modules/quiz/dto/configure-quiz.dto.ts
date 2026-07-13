import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import type { ConfigureQuizRequest } from '@zunibee/shared';
import { QuizLeaderboardMode, QuizVisibility } from '../entities/quiz.entity';
export class ConfigureQuizDto implements ConfigureQuizRequest {
  @IsOptional()
  @IsIn([10, 100, 1000], { message: 'Tổng điểm chỉ nhận 10, 100 hoặc 1000' })
  totalScore?: 10 | 100 | 1000;
  @IsOptional()
  @IsInt({ message: 'Thời gian phải là số nguyên' })
  @Min(1, { message: 'Thời gian phải lớn hơn 0' })
  timeLimitSeconds?: number | null;
  @IsOptional()
  @IsDateString({}, { message: 'Thời gian mở không hợp lệ' })
  opensAt?: string | null;
  @IsOptional() @IsDateString({}, { message: 'Hạn nộp không hợp lệ' }) dueAt?:
    string | null;
  @IsOptional()
  @IsInt({ message: 'Số lượt phải là số nguyên' })
  @Min(1, { message: 'Số lượt phải lớn hơn 0' })
  maxAttempts?: number | null;
  @IsOptional()
  @IsEnum(QuizVisibility, { message: 'Phạm vi quiz không hợp lệ' })
  visibility?: QuizVisibility;
  @IsOptional()
  @IsEnum(QuizLeaderboardMode, { message: 'Chế độ bảng xếp hạng không hợp lệ' })
  leaderboardMode?: QuizLeaderboardMode;
}
