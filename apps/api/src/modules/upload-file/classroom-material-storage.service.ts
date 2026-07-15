import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  type UploadApiErrorResponse,
  type UploadApiResponse,
} from 'cloudinary';
import { ClassroomMaterialStorageProvider } from '@/modules/classroom/entities/classroom-material.entity';
import { CLASSROOM_MATERIAL_UPLOAD_DIR } from '@/modules/upload-file/upload-file.constants';

export type StoredClassroomMaterial = {
  provider: ClassroomMaterialStorageProvider;
  key: string;
};

type StoreClassroomMaterialInput = {
  classroomId: string;
  storageName: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};

type CloudinaryStorageUsage = {
  usageBytes: number;
  limitBytes: number;
};

type CloudinaryUsageSnapshot = CloudinaryStorageUsage & {
  reservedBytes: number;
  expiresAt: number;
};

type CapacityReservation = {
  fallback: boolean;
  snapshot: CloudinaryUsageSnapshot | null;
};

class CloudinaryUploadError extends Error {
  readonly httpCode: number;

  constructor(error: UploadApiErrorResponse) {
    super(error.message);
    this.name = error.name || 'CloudinaryUploadError';
    this.httpCode = error.http_code;
  }
}

const CLOUDINARY_DOWNLOAD_TTL_SECONDS = 5 * 60;

@Injectable()
export class ClassroomMaterialStorageService {
  private readonly logger = new Logger(ClassroomMaterialStorageService.name);
  private readonly provider: ClassroomMaterialStorageProvider;
  private readonly fallbackToLocal: boolean;
  private readonly cloudinaryPrefix: string;
  private readonly fallbackPercent: number;
  private readonly usageCacheMs: number;
  private usageSnapshot: CloudinaryUsageSnapshot | null = null;
  private usageRefreshPromise: Promise<CloudinaryUsageSnapshot | null> | null =
    null;

  constructor(private readonly config: ConfigService) {
    this.provider = parseProvider(
      this.config.get<string>('FILE_STORAGE_DRIVER', 'local'),
    );
    this.fallbackToLocal = parseFallbackDriver(
      this.config.get<string>('FILE_STORAGE_FALLBACK_DRIVER', 'none'),
    );
    this.cloudinaryPrefix = normalizePrefix(
      this.config.get<string>('CLOUDINARY_STORAGE_PREFIX', 'zunibee'),
    );
    this.fallbackPercent = numberInRange(
      this.config.get<string>('CLOUDINARY_STORAGE_FALLBACK_PERCENT', '95'),
      1,
      100,
      'CLOUDINARY_STORAGE_FALLBACK_PERCENT',
    );
    this.usageCacheMs =
      numberInRange(
        this.config.get<string>('CLOUDINARY_USAGE_CACHE_SECONDS', '60'),
        10,
        3600,
        'CLOUDINARY_USAGE_CACHE_SECONDS',
      ) * 1000;

    if (this.provider === ClassroomMaterialStorageProvider.CLOUDINARY) {
      this.configureCloudinary();
    }
  }

  async store(
    input: StoreClassroomMaterialInput,
  ): Promise<StoredClassroomMaterial> {
    if (this.provider === ClassroomMaterialStorageProvider.LOCAL) {
      return this.storeLocal(input);
    }

    const reservation = await this.reserveCloudinaryCapacity(
      input.buffer.length,
    );
    if (reservation.fallback) return this.storeLocal(input);

    try {
      const key = await this.storeCloudinary(input);
      return { provider: ClassroomMaterialStorageProvider.CLOUDINARY, key };
    } catch (error) {
      this.releaseReservation(reservation, input.buffer.length);
      if (this.fallbackToLocal && isCloudinaryCapacityError(error)) {
        this.logger.warn(
          `Cloudinary từ chối do giới hạn dung lượng; chuyển sang local: ${safeError(error)}`,
        );
        return this.storeLocal(input);
      }
      throw error;
    }
  }

  async createReadStream(
    provider: ClassroomMaterialStorageProvider,
    key: string,
  ): Promise<Readable> {
    if (provider === ClassroomMaterialStorageProvider.LOCAL) {
      return createReadStream(this.safeLocalPath(key));
    }
    assertSafeCloudinaryKey(key);
    const expiresAt =
      Math.floor(Date.now() / 1000) + CLOUDINARY_DOWNLOAD_TTL_SECONDS;
    const url = cloudinary.utils.private_download_url(key, '', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: expiresAt,
      attachment: false,
    });
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || !response.body) {
      throw new ServiceUnavailableException(
        `Không thể tải tài liệu từ Cloudinary (HTTP ${response.status})`,
      );
    }
    return Readable.fromWeb(response.body as unknown as NodeReadableStream);
  }

  async delete(
    provider: ClassroomMaterialStorageProvider,
    key: string,
  ): Promise<void> {
    if (provider === ClassroomMaterialStorageProvider.LOCAL) {
      await unlink(this.safeLocalPath(key)).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      });
      return;
    }
    assertSafeCloudinaryKey(key);
    await cloudinary.uploader.destroy(key, {
      resource_type: 'raw',
      type: 'authenticated',
      invalidate: true,
    });
  }

  private async storeLocal(
    input: StoreClassroomMaterialInput,
  ): Promise<StoredClassroomMaterial> {
    await mkdir(CLASSROOM_MATERIAL_UPLOAD_DIR, { recursive: true });
    await writeFile(
      join(CLASSROOM_MATERIAL_UPLOAD_DIR, input.storageName),
      input.buffer,
      { flag: 'wx' },
    );
    return {
      provider: ClassroomMaterialStorageProvider.LOCAL,
      key: input.storageName,
    };
  }

  private async storeCloudinary(
    input: StoreClassroomMaterialInput,
  ): Promise<string> {
    const publicId = [
      this.cloudinaryPrefix,
      'classroom-materials',
      input.classroomId,
      input.storageName,
    ]
      .filter(Boolean)
      .join('/');
    assertSafeCloudinaryKey(publicId);

    return new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'authenticated',
          public_id: publicId,
          overwrite: false,
          unique_filename: false,
          use_filename: false,
          filename_override: input.originalName,
          context: { classroomId: input.classroomId },
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse): void => {
          if (error) {
            reject(new CloudinaryUploadError(error));
            return;
          }
          if (!result?.public_id) {
            reject(new Error('Cloudinary không trả về public_id'));
            return;
          }
          resolve(result.public_id);
        },
      );
      stream.end(input.buffer);
    });
  }

  private async reserveCloudinaryCapacity(
    bytes: number,
  ): Promise<CapacityReservation> {
    if (!this.fallbackToLocal) return { fallback: false, snapshot: null };
    const snapshot = await this.getCloudinaryUsage();
    if (!snapshot || snapshot.limitBytes <= 0) {
      return { fallback: false, snapshot: null };
    }

    const projectedBytes = snapshot.usageBytes + snapshot.reservedBytes + bytes;
    const projectedPercent = (projectedBytes / snapshot.limitBytes) * 100;
    if (projectedPercent >= this.fallbackPercent) {
      this.logger.warn(
        `Cloudinary storage dự kiến ${projectedPercent.toFixed(2)}%; chuyển upload sang local`,
      );
      return { fallback: true, snapshot: null };
    }
    snapshot.reservedBytes += bytes;
    return { fallback: false, snapshot };
  }

  private releaseReservation(
    reservation: CapacityReservation,
    bytes: number,
  ): void {
    if (!reservation.snapshot) return;
    reservation.snapshot.reservedBytes = Math.max(
      0,
      reservation.snapshot.reservedBytes - bytes,
    );
  }

  private async getCloudinaryUsage(): Promise<CloudinaryUsageSnapshot | null> {
    if (this.usageSnapshot && this.usageSnapshot.expiresAt > Date.now()) {
      return this.usageSnapshot;
    }
    if (this.usageRefreshPromise) return this.usageRefreshPromise;

    this.usageRefreshPromise = (async () => {
      try {
        const response: unknown = await cloudinary.api.usage();
        const usage = parseCloudinaryStorageUsage(response);
        if (!usage) return null;
        this.usageSnapshot = {
          ...usage,
          reservedBytes: 0,
          expiresAt: Date.now() + this.usageCacheMs,
        };
        return this.usageSnapshot;
      } catch (error) {
        this.logger.warn(
          `Không đọc được Cloudinary usage, vẫn thử upload cloud: ${safeError(error)}`,
        );
        return null;
      } finally {
        this.usageRefreshPromise = null;
      }
    })();
    return this.usageRefreshPromise;
  }

  private safeLocalPath(key: string): string {
    const filename = basename(key);
    if (!filename || filename !== key) {
      throw new Error('Khóa tệp local không hợp lệ');
    }
    return join(CLASSROOM_MATERIAL_UPLOAD_DIR, filename);
  }

  private configureCloudinary(): void {
    const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL')?.trim();
    if (cloudinaryUrl) {
      let parsed: URL;
      try {
        parsed = new URL(cloudinaryUrl);
      } catch {
        throw new Error('CLOUDINARY_URL không hợp lệ');
      }
      if (
        parsed.protocol !== 'cloudinary:' ||
        !parsed.hostname ||
        !parsed.username ||
        !parsed.password
      ) {
        throw new Error(
          'CLOUDINARY_URL phải có dạng cloudinary://API_KEY:API_SECRET@CLOUD_NAME',
        );
      }
      cloudinary.config({
        cloud_name: parsed.hostname,
        api_key: decodeURIComponent(parsed.username),
        api_secret: decodeURIComponent(parsed.password),
        secure: true,
      });
      return;
    }

    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        'Cloudinary cần CLOUDINARY_URL hoặc đủ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
      );
    }
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }
}

function parseProvider(value: string): ClassroomMaterialStorageProvider {
  switch (value.trim().toLowerCase()) {
    case 'local':
      return ClassroomMaterialStorageProvider.LOCAL;
    case 'cloudinary':
      return ClassroomMaterialStorageProvider.CLOUDINARY;
    default:
      throw new Error('FILE_STORAGE_DRIVER chỉ nhận local hoặc cloudinary');
  }
}

function parseFallbackDriver(value: string): boolean {
  switch (value.trim().toLowerCase()) {
    case 'none':
    case '':
      return false;
    case 'local':
      return true;
    default:
      throw new Error('FILE_STORAGE_FALLBACK_DRIVER chỉ nhận none hoặc local');
  }
}

function normalizePrefix(value: string): string {
  const normalized = value.trim().replace(/^\/+|\/+$/g, '');
  if (normalized.includes('..') || /[\0\r\n]/.test(normalized)) {
    throw new Error('CLOUDINARY_STORAGE_PREFIX không hợp lệ');
  }
  return normalized;
}

function numberInRange(
  value: string,
  min: number,
  max: number,
  name: string,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} phải nằm trong khoảng ${min}-${max}`);
  }
  return parsed;
}

function assertSafeCloudinaryKey(key: string): void {
  if (!key || key.length > 240 || /[\0\r\n]/.test(key)) {
    throw new Error('Cloudinary public_id không hợp lệ');
  }
}

export function parseCloudinaryStorageUsage(
  value: unknown,
): CloudinaryStorageUsage | null {
  if (!isRecord(value) || !isRecord(value.storage)) return null;
  const usageBytes = Number(value.storage.usage);
  const limitBytes = Number(value.storage.limit);
  if (
    !Number.isFinite(usageBytes) ||
    usageBytes < 0 ||
    !Number.isFinite(limitBytes) ||
    limitBytes <= 0
  ) {
    return null;
  }
  return { usageBytes, limitBytes };
}

export function isCloudinaryCapacityError(error: unknown): boolean {
  const message = safeError(error).toLowerCase();
  return (
    /(?:storage|quota|credit|usage).*(?:exceed|limit|full)/i.test(message) ||
    /(?:exceed|limit|full).*(?:storage|quota|credit|usage)/i.test(message) ||
    /account (?:is )?disabled/i.test(message)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeError(error: unknown): string {
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message.slice(0, 300);
  }
  return String(error).slice(0, 300);
}
