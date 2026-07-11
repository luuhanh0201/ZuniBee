import { Module } from '@nestjs/common';
import { UploadFileController } from '@/modules/upload-file/upload-file.controller';
import { UploadFileService } from '@/modules/upload-file/upload-file.service';

@Module({
  controllers: [UploadFileController],
  providers: [UploadFileService],
  exports: [UploadFileService],
})
export class UploadFileModule {}
