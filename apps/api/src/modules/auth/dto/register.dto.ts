import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole, type RegisterRequest } from '@zunibee/shared';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'hocsinh@vidu.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString({ message: 'Họ và tên không hợp lệ' })
  @MinLength(2, { message: 'Họ và tên phải có ít nhất 2 ký tự' })
  fullName!: string;

  @ApiProperty({ enum: [UserRole.STUDENT, UserRole.TEACHER] })
  @IsEnum([UserRole.STUDENT, UserRole.TEACHER], {
    message: 'Vui lòng chọn bạn là Giáo viên hay Học sinh',
  })
  role!: UserRole.STUDENT | UserRole.TEACHER;
}
