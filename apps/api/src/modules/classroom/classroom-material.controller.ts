import {
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
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import type { ClassroomMaterial } from '@zunibee/shared';
import { UserRole } from '@zunibee/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { ClassroomMaterialService } from '@/modules/classroom/classroom-material.service';
import { CreateClassroomMaterialFileDto } from '@/modules/classroom/dto/create-classroom-material-file.dto';
import { CreateClassroomMaterialLinkDto } from '@/modules/classroom/dto/create-classroom-material-link.dto';
import { UpdateClassroomMaterialDto } from '@/modules/classroom/dto/update-classroom-material.dto';
import {
  MAX_CLASSROOM_MATERIAL_FILES,
  MAX_CLASSROOM_MATERIAL_SIZE,
} from '@/modules/upload-file/upload-file.constants';
import { ExpensiveOperationRateLimit } from '@/common/security/rate-limit.decorator';

@ApiTags('classroom-materials')
@ApiBearerAuth()
@Controller('classrooms/:classroomId/materials')
export class ClassroomMaterialController {
  constructor(private readonly materialService: ClassroomMaterialService) {}

  @Roles(UserRole.TEACHER, UserRole.STUDENT)
  @Get()
  @ApiOperation({ summary: 'Danh sách tài liệu của lớp' })
  list(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ClassroomMaterial[]> {
    return this.materialService.list(classroomId, currentUser);
  }

  @Roles(UserRole.TEACHER)
  @Post('files')
  @ExpensiveOperationRateLimit()
  @ApiOperation({ summary: 'Giáo viên tải nhiều tệp tài liệu lên lớp' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        description: { type: 'string' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          maxItems: MAX_CLASSROOM_MATERIAL_FILES,
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', MAX_CLASSROOM_MATERIAL_FILES, {
      limits: {
        fileSize: MAX_CLASSROOM_MATERIAL_SIZE,
        files: MAX_CLASSROOM_MATERIAL_FILES,
      },
    }),
  )
  createFiles(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateClassroomMaterialFileDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<ClassroomMaterial[]> {
    return this.materialService.createFiles(
      classroomId,
      currentUser.id,
      dto,
      files,
    );
  }

  @Roles(UserRole.TEACHER)
  @Post('links')
  @ApiOperation({ summary: 'Giáo viên thêm tài liệu từ Google Drive' })
  createLink(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateClassroomMaterialLinkDto,
  ): Promise<ClassroomMaterial> {
    return this.materialService.createLink(classroomId, currentUser.id, dto);
  }

  @Roles(UserRole.TEACHER)
  @Patch(':materialId')
  @ApiOperation({ summary: 'Giáo viên cập nhật thông tin tài liệu' })
  update(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @Param('materialId', ParseUUIDPipe) materialId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateClassroomMaterialDto,
  ): Promise<ClassroomMaterial> {
    return this.materialService.update(
      classroomId,
      materialId,
      currentUser.id,
      dto,
    );
  }

  @Roles(UserRole.TEACHER)
  @Delete(':materialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Giáo viên xóa tài liệu khỏi lớp' })
  async remove(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @Param('materialId', ParseUUIDPipe) materialId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.materialService.remove(classroomId, materialId, currentUser.id);
  }

  @Roles(UserRole.TEACHER, UserRole.STUDENT)
  @Get(':materialId/download')
  @ApiOperation({ summary: 'Tải tệp tài liệu sau khi kiểm tra quyền lớp' })
  async download(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @Param('materialId', ParseUUIDPipe) materialId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.materialService.getDownload(
      classroomId,
      materialId,
      currentUser,
    );
    response.attachment(file.filename);
    response.type(file.mimeType);
    await pipeline(file.stream, response);
  }
}
