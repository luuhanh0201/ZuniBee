import { Injectable, Logger } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { AVATAR_UPLOAD_DIR } from '@/modules/upload-file/upload-file.constants';

@Injectable()
export class UploadFileService {
  private readonly logger = new Logger(UploadFileService.name);

  async deleteLocalAvatar(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl) return;

    let pathname: string;
    try {
      pathname = new URL(avatarUrl).pathname;
    } catch {
      return;
    }
    if (!pathname.startsWith('/uploads/avatars/')) return;

    const filename = basename(pathname);
    if (!filename) return;

    try {
      await unlink(join(AVATAR_UPLOAD_DIR, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Không thể xóa avatar cũ: ${filename}`);
      }
    }
  }
}
