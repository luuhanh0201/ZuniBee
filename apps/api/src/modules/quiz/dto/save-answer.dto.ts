import { IsArray, IsUUID } from 'class-validator';
import type { SaveQuizAnswerRequest } from '@zunibee/shared';
export class SaveAnswerDto implements SaveQuizAnswerRequest {
  @IsArray({ message: 'Danh sách đáp án không hợp lệ' })
  @IsUUID('4', { each: true, message: 'ID đáp án không hợp lệ' })
  selectedOptionIds!: string[];
}
