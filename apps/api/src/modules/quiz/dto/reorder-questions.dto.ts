import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import type { ReorderQuizQuestionsRequest } from '@zunibee/shared';
export class ReorderQuestionsDto implements ReorderQuizQuestionsRequest {
  @IsArray({ message: 'Thứ tự câu hỏi không hợp lệ' })
  @ArrayMinSize(1, { message: 'Danh sách câu hỏi không được trống' })
  @ArrayMaxSize(500, { message: 'Một quiz tối đa 500 câu hỏi' })
  @IsUUID('4', { each: true, message: 'ID câu hỏi không hợp lệ' })
  questionIds!: string[];
}
