import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole, type RegisterRequest } from '@zunibee/shared';
import { MaxByteLength } from '@/common/validation/max-byte-length.decorator';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'hocsinh@vidu.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxByteLength(72, { message: 'Mật khẩu tối đa 72 byte UTF-8' })
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString({ message: 'Họ và tên không hợp lệ' })
  @MinLength(2, { message: 'Họ và tên phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Họ và tên tối đa 100 ký tự' })
  fullName!: string;

  @ApiProperty({ enum: [UserRole.STUDENT, UserRole.TEACHER] })
  @IsEnum([UserRole.STUDENT, UserRole.TEACHER], {
    message: 'Vui lòng chọn bạn là Giáo viên hay Học sinh',
  })
  role!: UserRole.STUDENT | UserRole.TEACHER;
}
