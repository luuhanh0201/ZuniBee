import { join } from 'node:path';

export const UPLOAD_ROOT = join(__dirname, '..', '..', '..', 'uploads');
export const AVATAR_UPLOAD_DIR = join(UPLOAD_ROOT, 'avatars');
export const PROTECTED_UPLOAD_ROOT = join(
  __dirname,
  '..',
  '..',
  '..',
  'protected-uploads',
);
export const CLASSROOM_MATERIAL_UPLOAD_DIR = join(
  PROTECTED_UPLOAD_ROOT,
  'classroom-materials',
);
export const MAX_CLASSROOM_MATERIAL_SIZE = 10 * 1024 * 1024;
export const MAX_CLASSROOM_MATERIAL_FILES = 10;
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
