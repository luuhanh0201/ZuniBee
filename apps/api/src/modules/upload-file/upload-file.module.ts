import { Module } from '@nestjs/common';
import { UploadFileController } from '@/modules/upload-file/upload-file.controller';
import { UploadFileService } from '@/modules/upload-file/upload-file.service';
import { ClassroomMaterialStorageService } from '@/modules/upload-file/classroom-material-storage.service';

@Module({
  controllers: [UploadFileController],
  providers: [UploadFileService, ClassroomMaterialStorageService],
  exports: [UploadFileService, ClassroomMaterialStorageService],
})
export class UploadFileModule {}
