import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { UserRole } from '@zunibee/shared';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { ClassroomMaterialService } from '@/modules/classroom/classroom-material.service';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';
import {
  ClassroomMaterial,
  ClassroomMaterialStorageProvider,
  ClassroomMaterialType,
} from '@/modules/classroom/entities/classroom-material.entity';
import { ClassroomMember } from '@/modules/classroom/entities/classroom-member.entity';
import { ClassroomMaterialStorageService } from '@/modules/upload-file/classroom-material-storage.service';

function repositoryMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value) => Promise.resolve(value)),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

const teacher: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'teacher@example.com',
  role: UserRole.TEACHER,
};

const student: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'student@example.com',
  role: UserRole.STUDENT,
};

describe('ClassroomMaterialService', () => {
  const materialRepository = repositoryMock();
  const classroomRepository = repositoryMock();
  const memberRepository = repositoryMock();
  const storage = {
    store: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    createReadStream: jest.fn(),
  };
  const service = new ClassroomMaterialService(
    materialRepository as unknown as Repository<ClassroomMaterial>,
    classroomRepository as unknown as Repository<Classroom>,
    memberRepository as unknown as Repository<ClassroomMember>,
    storage as unknown as ClassroomMaterialStorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a classroom member to list materials', async () => {
    classroomRepository.findOne.mockResolvedValue({
      id: 'classroom-id',
      teacherId: teacher.id,
    });
    memberRepository.findOne.mockResolvedValue({ id: 'membership-id' });
    materialRepository.find.mockResolvedValue([
      {
        id: 'material-id',
        title: 'Bài đọc',
        description: null,
        type: ClassroomMaterialType.LINK,
        url: 'https://example.com/document',
        originalName: null,
        mimeType: null,
        size: null,
        createdAt: new Date('2026-07-12T01:00:00.000Z'),
        updatedAt: new Date('2026-07-12T01:00:00.000Z'),
      },
    ]);

    await expect(service.list('classroom-id', student)).resolves.toEqual([
      expect.objectContaining({
        id: 'material-id',
        type: 'link',
        url: 'https://example.com/document',
      }),
    ]);
  });

  it('rejects a student who is not a member', async () => {
    classroomRepository.findOne.mockResolvedValue({
      id: 'classroom-id',
      teacherId: teacher.id,
    });
    memberRepository.findOne.mockResolvedValue(null);

    await expect(service.list('classroom-id', student)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(materialRepository.find).not.toHaveBeenCalled();
  });

  it('rejects uploads from a teacher who does not own the classroom', async () => {
    classroomRepository.findOne.mockResolvedValue({
      id: 'classroom-id',
      teacherId: teacher.id,
    });
    await expect(
      service.createFiles('classroom-id', 'another-teacher', {}, undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists the provider selected by the storage chain', async () => {
    classroomRepository.findOne.mockResolvedValue({
      id: 'classroom-id',
      teacherId: teacher.id,
    });
    storage.store.mockResolvedValue({
      provider: ClassroomMaterialStorageProvider.CLOUDINARY,
      key: 'zunibee/classroom-materials/classroom-id/file.pdf',
    });
    materialRepository.save.mockImplementation((entities) =>
      Promise.resolve(
        (entities as ClassroomMaterial[]).map((entity, index) => ({
          ...entity,
          id: `material-${index}`,
          createdAt: new Date('2026-07-15T01:00:00.000Z'),
          updatedAt: new Date('2026-07-15T01:00:00.000Z'),
        })),
      ),
    );
    const file = {
      originalname: 'lesson.pdf',
      mimetype: 'application/pdf',
      size: 5,
      buffer: Buffer.from('%PDF-'),
    } as Express.Multer.File;

    await service.createFiles('classroom-id', teacher.id, {}, [file]);

    expect(materialRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        storageProvider: ClassroomMaterialStorageProvider.CLOUDINARY,
        storageName: 'zunibee/classroom-materials/classroom-id/file.pdf',
      }),
    );
  });
});
