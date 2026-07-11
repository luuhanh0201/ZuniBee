import { Body, Controller, NotFoundException, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@zunibee/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { UpdateProfileDto } from '@/modules/user/dto/update-profile.dto';
import type { User } from '@/modules/user/entities/user.entity';
import { UserService } from '@/modules/user/user.service';

function toProfile(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    roleSelected: user.roleSelected,
    avatar: user.avatar ?? null,
    phone: user.phone ?? null,
  };
}

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật hồ sơ người dùng hiện tại' })
  async updateProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUser> {
    const user = await this.userService.updateProfile(currentUser.id, dto);
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    return toProfile(user);
  }
}
