import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type ClassroomDetail,
  type ClassroomInvitation,
  type ClassroomJoinPreview,
  type ClassroomSummary,
  type InviteStudentsResponse,
  type JoinClassroomResult,
  type RegenerateClassroomAccessResponse,
} from '@zunibee/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { ClassroomService } from '@/modules/classroom/classroom.service';
import { CreateClassroomDto } from '@/modules/classroom/dto/create-classroom.dto';
import { InviteStudentsDto } from '@/modules/classroom/dto/invite-students.dto';
import { JoinClassroomByCodeDto } from '@/modules/classroom/dto/join-classroom-by-code.dto';

@ApiTags('classrooms')
@ApiBearerAuth()
@Controller('classrooms')
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  @Roles(UserRole.TEACHER)
  @Post()
  @ApiOperation({ summary: 'Giáo viên tạo lớp học' })
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateClassroomDto,
  ): Promise<ClassroomDetail> {
    return this.classroomService.create(currentUser.id, dto);
  }

  @Roles(UserRole.TEACHER, UserRole.STUDENT)
  @Get('mine')
  @ApiOperation({ summary: 'Danh sách lớp đang sở hữu hoặc đã tham gia' })
  listMine(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ClassroomSummary[]> {
    return this.classroomService.listMine(currentUser);
  }

  @Roles(UserRole.STUDENT)
  @Post('join/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Học sinh tham gia lớp bằng mã lớp' })
  joinByCode(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: JoinClassroomByCodeDto,
  ): Promise<JoinClassroomResult> {
    return this.classroomService.joinByCode(dto.code, currentUser.id);
  }

  @Public()
  @Get('join/link/:token/preview')
  @ApiOperation({ summary: 'Xem trước lớp từ liên kết chia sẻ' })
  previewJoinLink(
    @Param('token') token: string,
  ): Promise<ClassroomJoinPreview> {
    return this.classroomService.previewJoinLink(token);
  }

  @Roles(UserRole.STUDENT)
  @Post('join/link/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Học sinh tham gia lớp bằng liên kết chia sẻ' })
  joinByLink(
    @Param('token') token: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<JoinClassroomResult> {
    return this.classroomService.joinByLink(token, currentUser.id);
  }

  @Public()
  @Get('invitations/:token/preview')
  @ApiOperation({ summary: 'Xem trước lời mời lớp học qua email' })
  previewEmailInvitation(
    @Param('token') token: string,
  ): Promise<ClassroomJoinPreview> {
    return this.classroomService.previewEmailInvitation(token);
  }

  @Roles(UserRole.STUDENT)
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chấp nhận lời mời lớp học qua email' })
  acceptEmailInvitation(
    @Param('token') token: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<JoinClassroomResult> {
    return this.classroomService.acceptEmailInvitation(token, currentUser);
  }

  @Roles(UserRole.TEACHER)
  @Post(':id/invitations')
  @ApiOperation({ summary: 'Mời học sinh vào lớp bằng email' })
  inviteStudents(
    @Param('id', ParseUUIDPipe) classroomId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: InviteStudentsDto,
  ): Promise<InviteStudentsResponse> {
    return this.classroomService.inviteStudents(
      classroomId,
      currentUser.id,
      dto,
    );
  }

  @Roles(UserRole.TEACHER)
  @Post(':id/invitations/:invitationId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi lại lời mời lớp học qua email' })
  resendInvitation(
    @Param('id', ParseUUIDPipe) classroomId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ClassroomInvitation> {
    return this.classroomService.resendInvitation(
      classroomId,
      invitationId,
      currentUser.id,
    );
  }

  @Roles(UserRole.TEACHER)
  @Delete(':id/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Thu hồi lời mời lớp học qua email' })
  async revokeInvitation(
    @Param('id', ParseUUIDPipe) classroomId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.classroomService.revokeInvitation(
      classroomId,
      invitationId,
      currentUser.id,
    );
  }

  @Roles(UserRole.TEACHER)
  @Post(':id/access/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo lại mã và liên kết tham gia lớp' })
  regenerateAccess(
    @Param('id', ParseUUIDPipe) classroomId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RegenerateClassroomAccessResponse> {
    return this.classroomService.regenerateAccess(classroomId, currentUser.id);
  }

  @Roles(UserRole.TEACHER, UserRole.STUDENT)
  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết lớp dành cho giáo viên sở hữu hoặc thành viên',
  })
  getDetail(
    @Param('id', ParseUUIDPipe) classroomId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ClassroomDetail> {
    return this.classroomService.getDetail(classroomId, currentUser);
  }
}
