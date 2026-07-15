import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import type { Readable } from 'node:stream';
import { Repository } from 'typeorm';
import {
  UserRole,
  type ClassroomMaterial as MaterialResponse,
} from '@zunibee/shared';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';
import { ClassroomMember } from '@/modules/classroom/entities/classroom-member.entity';
import {
  ClassroomMaterial,
  ClassroomMaterialStorageProvider,
  ClassroomMaterialType,
} from '@/modules/classroom/entities/classroom-material.entity';
import { CreateClassroomMaterialFileDto } from '@/modules/classroom/dto/create-classroom-material-file.dto';
import { UpdateClassroomMaterialDto } from '@/modules/classroom/dto/update-classroom-material.dto';
import { ClassroomMaterialStorageService } from '@/modules/upload-file/classroom-material-storage.service';
import { assertDeclaredFileType } from '@/modules/upload-file/upload-file-validation.util';

const ALLOWED_MATERIAL_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/zip',
]);

const MATERIAL_EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    '.pptx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'text/plain': '.txt',
  'application/zip': '.zip',
};

@Injectable()
export class ClassroomMaterialService {
  constructor(
    @InjectRepository(ClassroomMaterial)
    private readonly materialRepository: Repository<ClassroomMaterial>,
    @InjectRepository(Classroom)
    private readonly classroomRepository: Repository<Classroom>,
    @InjectRepository(ClassroomMember)
    private readonly memberRepository: Repository<ClassroomMember>,
    private readonly storage: ClassroomMaterialStorageService,
  ) {}

  async list(
    classroomId: string,
    currentUser: AuthenticatedUser,
  ): Promise<MaterialResponse[]> {
    await this.assertCanAccess(classroomId, currentUser);
    const materials = await this.materialRepository.find({
      where: { classroomId },
      order: { createdAt: 'DESC' },
    });
    return materials.map((material) => this.toResponse(material));
  }

  async createFiles(
    classroomId: string,
    teacherId: string,
    dto: CreateClassroomMaterialFileDto,
    files: Express.Multer.File[] | undefined,
  ): Promise<MaterialResponse[]> {
    await this.assertOwner(classroomId, teacherId);
    if (!files?.length)
      throw new BadRequestException('Vui lòng chọn ít nhất một tệp');
    const invalidFile = files.find(
      (file) => !ALLOWED_MATERIAL_MIME_TYPES.has(file.mimetype),
    );
    if (invalidFile) {
      throw new BadRequestException(
        `Tệp ${invalidFile.originalname} không thuộc định dạng được hỗ trợ`,
      );
    }
    files.forEach((file) => assertDeclaredFileType(file));

    const pendingFiles = files.map((file) => {
      const originalName = safeOriginalName(file.originalname);
      const titleExtension = extname(originalName).slice(0, 16);
      const storageExtension = MATERIAL_EXTENSION_BY_MIME[file.mimetype];
      return {
        file,
        originalName,
        titleExtension,
        storageName: `${randomUUID()}${storageExtension}`,
      };
    });
    const uploadResults = await Promise.allSettled(
      pendingFiles.map(async (pending) => ({
        ...pending,
        stored: await this.storage.store({
          classroomId,
          storageName: pending.storageName,
          originalName: pending.originalName,
          mimeType: pending.file.mimetype,
          buffer: pending.file.buffer,
        }),
      })),
    );
    const storedFiles = uploadResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
    const failedUpload = uploadResults.find(
      (result) => result.status === 'rejected',
    );
    if (failedUpload?.status === 'rejected') {
      await this.cleanupStoredFiles(storedFiles);
      throw failedUpload.reason;
    }

    try {
      const entities = storedFiles.map(
        ({ file, originalName, titleExtension, stored }) =>
          this.materialRepository.create({
            classroomId,
            title:
              basename(originalName, titleExtension).trim().slice(0, 160) ||
              'Tài liệu',
            description: dto.description ?? null,
            type: ClassroomMaterialType.FILE,
            url: null,
            storageName: stored.key,
            storageProvider: stored.provider,
            originalName,
            mimeType: file.mimetype,
            size: file.size,
          }),
      );
      const saved = await this.materialRepository.save(entities);
      return saved.map((material) => this.toResponse(material));
    } catch (error) {
      await this.cleanupStoredFiles(storedFiles);
      throw error;
    }
  }

  async update(
    classroomId: string,
    materialId: string,
    teacherId: string,
    dto: UpdateClassroomMaterialDto,
  ): Promise<MaterialResponse> {
    await this.assertOwner(classroomId, teacherId);
    const material = await this.loadMaterial(classroomId, materialId);
    if (dto.url !== undefined && material.type !== ClassroomMaterialType.LINK) {
      throw new BadRequestException(
        'Không thể đổi liên kết của tài liệu dạng tệp',
      );
    }
    if (dto.title !== undefined) material.title = dto.title;
    if (dto.description !== undefined)
      material.description = dto.description || null;
    if (dto.url !== undefined) material.url = dto.url;
    return this.toResponse(await this.materialRepository.save(material));
  }

  async remove(
    classroomId: string,
    materialId: string,
    teacherId: string,
  ): Promise<void> {
    await this.assertOwner(classroomId, teacherId);
    const material = await this.loadMaterial(classroomId, materialId);
    if (material.storageName) {
      await this.storage.delete(
        material.storageProvider ?? ClassroomMaterialStorageProvider.LOCAL,
        material.storageName,
      );
    }
    await this.materialRepository.remove(material);
  }

  async getDownload(
    classroomId: string,
    materialId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ stream: Readable; filename: string; mimeType: string }> {
    await this.assertCanAccess(classroomId, currentUser);
    const material = await this.loadMaterial(classroomId, materialId);
    if (!material.storageName || material.type !== ClassroomMaterialType.FILE) {
      throw new BadRequestException('Tài liệu này không phải là tệp tải xuống');
    }
    return {
      stream: await this.storage.createReadStream(
        material.storageProvider ?? ClassroomMaterialStorageProvider.LOCAL,
        material.storageName,
      ),
      filename: material.originalName ?? material.title,
      mimeType: material.mimeType ?? 'application/octet-stream',
    };
  }

  private async assertOwner(classroomId: string, teacherId: string) {
    const classroom = await this.classroomRepository.findOne({
      where: { id: classroomId },
    });
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    if (classroom.teacherId !== teacherId) {
      throw new ForbiddenException(
        'Bạn không có quyền quản lý tài liệu lớp này',
      );
    }
  }

  private async assertCanAccess(
    classroomId: string,
    currentUser: AuthenticatedUser,
  ) {
    const classroom = await this.classroomRepository.findOne({
      where: { id: classroomId },
    });
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    if (
      currentUser.role === UserRole.TEACHER &&
      classroom.teacherId === currentUser.id
    ) {
      return;
    }
    if (currentUser.role === UserRole.STUDENT) {
      const membership = await this.memberRepository.findOne({
        where: { classroomId, userId: currentUser.id },
      });
      if (membership) return;
    }
    throw new ForbiddenException(
      'Bạn không có quyền truy cập tài liệu lớp này',
    );
  }

  private async loadMaterial(classroomId: string, materialId: string) {
    const material = await this.materialRepository.findOne({
      where: { id: materialId, classroomId },
    });
    if (!material) throw new NotFoundException('Tài liệu không tồn tại');
    return material;
  }

  private async cleanupStoredFiles(
    files: Array<{
      stored: {
        provider: ClassroomMaterialStorageProvider;
        key: string;
      };
    }>,
  ): Promise<void> {
    await Promise.allSettled(
      files.map(({ stored }) =>
        this.storage.delete(stored.provider, stored.key),
      ),
    );
  }

  private toResponse(material: ClassroomMaterial): MaterialResponse {
    return {
      id: material.id,
      title: material.title,
      description: material.description,
      type: material.type,
      url: material.url,
      originalName: material.originalName,
      mimeType: material.mimeType,
      size: material.size,
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
    };
  }
}

function safeOriginalName(value: string): string {
  const filename = basename(
    value.replace(/\\/g, '/').replace(/[\0\r\n]/g, ''),
  ).slice(0, 255);
  return filename || 'tai-lieu';
}
