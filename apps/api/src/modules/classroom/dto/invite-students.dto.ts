import { Transform, type TransformFnParams } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { InviteStudentsRequest } from '@zunibee/shared';

function normalizeEmailArray({ value }: TransformFnParams): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((email: unknown) =>
    typeof email === 'string' ? email.trim().toLowerCase() : email,
  );
}

export class InviteStudentsDto implements InviteStudentsRequest {
  @ApiProperty({
    type: [String],
    example: ['hocsinh1@vidu.com', 'hocsinh2@vidu.com'],
  })
  @Transform(normalizeEmailArray)
  @IsArray({ message: 'Danh sách email không hợp lệ' })
  @ArrayMinSize(1, { message: 'Cần nhập ít nhất một email' })
  @ArrayMaxSize(100, { message: 'Mỗi lần chỉ được mời tối đa 100 email' })
  @IsEmail({}, { each: true, message: 'Danh sách chứa email không hợp lệ' })
  emails!: string[];
}
