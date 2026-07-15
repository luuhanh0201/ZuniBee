import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  v2 as mockedCloudinary,
  type UploadApiOptions,
  type UploadApiResponse,
  type UploadResponseCallback,
} from 'cloudinary';
import { ClassroomMaterialStorageProvider } from '@/modules/classroom/entities/classroom-material.entity';
import {
  ClassroomMaterialStorageService,
  isCloudinaryCapacityError,
  parseCloudinaryStorageUsage,
} from '@/modules/upload-file/classroom-material-storage.service';

/*
 * Jest hoists the module factory, so the mock functions are read back from the
 * mocked SDK after initialization instead of being captured from a TDZ.
 */
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    api: { usage: jest.fn() },
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
    utils: { private_download_url: jest.fn() },
  },
}));

const mockUsage = jest.mocked(mockedCloudinary.api.usage);
const mockDestroy = jest.mocked(mockedCloudinary.uploader.destroy);
const mockUploadStream = jest.mocked(mockedCloudinary.uploader.upload_stream);

function config(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

function cloudinaryConfig(
  overrides: Record<string, string> = {},
): ConfigService {
  return config({
    FILE_STORAGE_DRIVER: 'cloudinary',
    FILE_STORAGE_FALLBACK_DRIVER: 'local',
    CLOUDINARY_STORAGE_PREFIX: 'zunibee',
    CLOUDINARY_STORAGE_FALLBACK_PERCENT: '95',
    CLOUDINARY_CLOUD_NAME: 'zunibee-test',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    ...overrides,
  });
}

describe('ClassroomMaterialStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsage.mockResolvedValue({
      storage: { usage: 10, limit: 1_000_000 },
    });
    mockDestroy.mockResolvedValue({ result: 'ok' });
    mockUploadStream.mockImplementation(
      (options: UploadApiOptions, callback: UploadResponseCallback) => ({
        end: (): void => {
          callback(undefined, {
            public_id: String(options.public_id),
          } as UploadApiResponse);
        },
      }),
    );
  });

  it('stores private raw assets on Cloudinary while capacity is available', async () => {
    const service = new ClassroomMaterialStorageService(cloudinaryConfig());

    await expect(
      service.store({
        classroomId: 'classroom-id',
        storageName: 'material.pdf',
        originalName: 'Bài học.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-'),
      }),
    ).resolves.toEqual({
      provider: ClassroomMaterialStorageProvider.CLOUDINARY,
      key: 'zunibee/classroom-materials/classroom-id/material.pdf',
    });
    expect(mockUploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'raw',
        type: 'authenticated',
        public_id: 'zunibee/classroom-materials/classroom-id/material.pdf',
        overwrite: false,
      }),
      expect.any(Function),
    );
  });

  it('falls back to local before Cloudinary reaches the configured limit', async () => {
    mockUsage.mockResolvedValue({ storage: { usage: 95, limit: 100 } });
    const service = new ClassroomMaterialStorageService(cloudinaryConfig());
    const storageName = `${randomUUID()}.pdf`;

    const stored = await service.store({
      classroomId: 'classroom-id',
      storageName,
      originalName: 'lesson.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-'),
    });

    expect(stored).toEqual({
      provider: ClassroomMaterialStorageProvider.LOCAL,
      key: storageName,
    });
    expect(mockUploadStream).not.toHaveBeenCalled();
    await service.delete(stored.provider, stored.key);
  });

  it('does not hide invalid Cloudinary credentials behind local fallback', async () => {
    mockUploadStream.mockImplementation(
      (_options: UploadApiOptions, callback: UploadResponseCallback) => ({
        end: (): void => {
          callback({
            message: 'Invalid API key',
            name: 'Error',
            http_code: 401,
          });
        },
      }),
    );
    const service = new ClassroomMaterialStorageService(cloudinaryConfig());

    await expect(
      service.store({
        classroomId: 'classroom-id',
        storageName: 'material.pdf',
        originalName: 'lesson.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-'),
      }),
    ).rejects.toMatchObject({ httpCode: 401 });
  });

  it('falls back to local when Cloudinary rejects an upload for storage quota', async () => {
    mockUsage.mockResolvedValue({});
    mockUploadStream.mockImplementation(
      (_options: UploadApiOptions, callback: UploadResponseCallback) => ({
        end: (): void => {
          callback({
            message: 'Storage quota exceeded',
            name: 'Error',
            http_code: 400,
          });
        },
      }),
    );
    const service = new ClassroomMaterialStorageService(cloudinaryConfig());
    const storageName = `${randomUUID()}.pdf`;

    const stored = await service.store({
      classroomId: 'classroom-id',
      storageName,
      originalName: 'lesson.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-'),
    });

    expect(stored.provider).toBe(ClassroomMaterialStorageProvider.LOCAL);
    await service.delete(stored.provider, stored.key);
  });

  it('deletes authenticated raw assets from Cloudinary', async () => {
    const service = new ClassroomMaterialStorageService(cloudinaryConfig());
    const key = 'zunibee/classroom-materials/classroom-id/material.pdf';

    await service.delete(ClassroomMaterialStorageProvider.CLOUDINARY, key);

    expect(mockDestroy).toHaveBeenCalledWith(key, {
      resource_type: 'raw',
      type: 'authenticated',
      invalidate: true,
    });
  });
});

describe('Cloudinary storage guards', () => {
  it('parses storage usage from the Admin API response', () => {
    expect(
      parseCloudinaryStorageUsage({
        storage: { usage: 25, limit: 100, used_percent: 25 },
      }),
    ).toEqual({ usageBytes: 25, limitBytes: 100 });
  });

  it('only treats capacity errors as fallback candidates', () => {
    expect(isCloudinaryCapacityError(new Error('Storage quota exceeded'))).toBe(
      true,
    );
    expect(isCloudinaryCapacityError(new Error('Invalid API key'))).toBe(false);
  });
});
