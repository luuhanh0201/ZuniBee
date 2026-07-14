import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { UploadFileResponse } from '@zunibee/shared';
import {
  AVATAR_EXTENSION_BY_MIME,
  AVATAR_UPLOAD_DIR,
  MAX_AVATAR_SIZE,
} from '@/modules/upload-file/upload-file.constants';
import { verifiedImageMime } from '@/modules/upload-file/upload-file-validation.util';
import { ExpensiveOperationRateLimit } from '@/common/security/rate-limit.decorator';

@ApiTags('upload-file')
@Controller('upload-file')
export class UploadFileController {
  @Post('avatar')
  @ExpensiveOperationRateLimit()
  @ApiOperation({ summary: 'Upload ảnh đại diện vào bộ nhớ cục bộ' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_AVATAR_SIZE, files: 1 },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ): Promise<UploadFileResponse> {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh để tải lên');
    const mime = verifiedImageMime(file.buffer);
    const filename = `${randomUUID()}${AVATAR_EXTENSION_BY_MIME[mime]}`;
    await mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
    await writeFile(`${AVATAR_UPLOAD_DIR}/${filename}`, file.buffer, {
      flag: 'wx',
    });

    return {
      url: `${req.protocol}://${req.get('host')}/uploads/avatars/${filename}`,
    };
  }
}
