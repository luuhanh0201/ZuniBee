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
import { mkdirSync } from 'node:fs';
import { diskStorage } from 'multer';
import type { UploadFileResponse } from '@zunibee/shared';
import {
  AVATAR_EXTENSION_BY_MIME,
  AVATAR_UPLOAD_DIR,
  MAX_AVATAR_SIZE,
} from '@/modules/upload-file/upload-file.constants';

@ApiTags('upload-file')
@Controller('upload-file')
export class UploadFileController {
  @Post('avatar')
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
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
          callback(null, AVATAR_UPLOAD_DIR);
        },
        filename: (_req, file, callback) => {
          const extension = AVATAR_EXTENSION_BY_MIME[file.mimetype];
          callback(null, `${randomUUID()}${extension ?? ''}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!AVATAR_EXTENSION_BY_MIME[file.mimetype]) {
          callback(
            new BadRequestException(
              'Ảnh phải có định dạng JPEG, PNG, WebP hoặc GIF',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ): UploadFileResponse {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh để tải lên');

    return {
      url: `${req.protocol}://${req.get('host')}/uploads/avatars/${file.filename}`,
    };
  }
}
