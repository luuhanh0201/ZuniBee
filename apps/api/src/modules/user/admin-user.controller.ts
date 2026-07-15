import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, type AdminUserStatusFilter } from '@zunibee/shared';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { AdminUserService } from '@/modules/user/admin-user.service';
import { UpdateUserStatusDto } from '@/modules/user/dto/update-user-status.dto';
import { UpdateUserRoleDto } from '@/modules/user/dto/update-user-role.dto';

const STATUS_FILTERS: AdminUserStatusFilter[] = ['active', 'banned', 'deleted'];
const ROLE_FILTERS = Object.values(UserRole);

@ApiTags('admin-users')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly adminUsers: AdminUserService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách người dùng (tìm kiếm, lọc, phân trang)' })
  list(
    @Query('query') query?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (role !== undefined && !ROLE_FILTERS.includes(role as UserRole))
      throw new BadRequestException('Vai trò lọc không hợp lệ');
    if (
      status !== undefined &&
      !STATUS_FILTERS.includes(status as AdminUserStatusFilter)
    )
      throw new BadRequestException('Trạng thái lọc không hợp lệ');
    return this.adminUsers.list({
      query: query?.slice(0, 200),
      role: role as UserRole | undefined,
      status: status as AdminUserStatusFilter | undefined,
      page: parsePositiveInteger(page, 'page'),
      pageSize: parsePositiveInteger(pageSize, 'pageSize'),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết người dùng kèm thống kê hoạt động' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsers.getDetail(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Khóa hoặc mở khóa tài khoản' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsers.updateStatus(id, dto.status, admin.id);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Đổi vai trò (user sẽ bị đăng xuất)' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsers.updateRole(id, dto.role, admin.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa mềm tài khoản (khôi phục được)' })
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsers.softDelete(id, admin.id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Khôi phục tài khoản đã xóa mềm' })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsers.restore(id, admin.id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa vĩnh viễn (chỉ với tài khoản đã xóa mềm, CASCADE dữ liệu)',
  })
  hardDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsers.hardDelete(id, admin.id);
  }
}

function parsePositiveInteger(
  value: string | undefined,
  field: string,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new BadRequestException(`Tham số ${field} phải là số nguyên dương`);
  return parsed;
}
