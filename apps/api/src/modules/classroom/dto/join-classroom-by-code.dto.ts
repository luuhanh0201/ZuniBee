import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { JoinClassroomByCodeRequest } from '@zunibee/shared';

function normalizeCode({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z2-9]{8}$/.test(trimmed)
    ? `${trimmed.slice(0, 4)}-${trimmed.slice(4)}`
    : trimmed;
}

export class JoinClassroomByCodeDto implements JoinClassroomByCodeRequest {
  @ApiProperty({ example: 'ABCD-EFGH' })
  @Transform(normalizeCode)
  @IsString({ message: 'Mã lớp không hợp lệ' })
  @Matches(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/, {
    message: 'Mã lớp không đúng định dạng',
  })
  code!: string;
}
