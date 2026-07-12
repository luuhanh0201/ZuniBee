import { Transform, type TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CreateClassroomRequest } from '@zunibee/shared';

function trimText({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalText({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
}

export class CreateClassroomDto implements CreateClassroomRequest {
  @ApiProperty({ example: 'Toán 10A1', minLength: 2, maxLength: 120 })
  @Transform(trimText)
  @IsString({ message: 'Tên lớp không hợp lệ' })
  @Length(2, 120, { message: 'Tên lớp phải có từ 2 đến 120 ký tự' })
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Mô tả lớp không hợp lệ' })
  @MaxLength(2000, { message: 'Mô tả lớp không được quá 2000 ký tự' })
  description?: string;

  @ApiPropertyOptional({ example: 'Toán học', maxLength: 120 })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Môn học không hợp lệ' })
  @MaxLength(120, { message: 'Môn học không được quá 120 ký tự' })
  subject?: string;

  @ApiPropertyOptional({ example: '10', maxLength: 50 })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Khối/lớp không hợp lệ' })
  @MaxLength(50, { message: 'Khối/lớp không được quá 50 ký tự' })
  grade?: string;
}
