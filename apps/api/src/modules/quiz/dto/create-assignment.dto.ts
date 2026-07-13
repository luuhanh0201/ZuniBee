import { IsEnum, IsUUID } from 'class-validator';
import type { CreateQuizAssignmentRequest } from '@zunibee/shared';
import { QuizAssignmentTargetType } from '../entities/quiz-assignment.entity';
export class CreateAssignmentDto implements CreateQuizAssignmentRequest {
  @IsEnum(QuizAssignmentTargetType, {
    message: 'Loại đối tượng gán không hợp lệ',
  })
  targetType!: QuizAssignmentTargetType;
  @IsUUID('4', { message: 'ID đối tượng gán không hợp lệ' }) targetId!: string;
}
