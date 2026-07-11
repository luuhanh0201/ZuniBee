import { join } from 'node:path';

export const UPLOAD_ROOT = join(__dirname, '..', '..', '..', 'uploads');
export const AVATAR_UPLOAD_DIR = join(UPLOAD_ROOT, 'avatars');
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
