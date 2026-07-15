import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { assertDeclaredFileType } from '@/modules/upload-file/upload-file-validation.util';
import { AI_GENERATION_SOURCE_UPLOAD_DIR } from '@/modules/upload-file/upload-file.constants';
import { MAX_AI_SOURCE_SIZE } from './ai-material-source.service';

const EXTENSION_BY_MIME: Record<string, string> = {
  'text/plain': '.txt',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
};

@Injectable()
export class AiGenerationSourceStorageService {
  async store(jobId: string, file: Express.Multer.File): Promise<string> {
    if (file.size > MAX_AI_SOURCE_SIZE)
      throw new BadRequestException('Tài liệu AI không được vượt quá 50 MB');
    assertDeclaredFileType(file);
    const extension =
      EXTENSION_BY_MIME[file.mimetype] ?? extname(file.originalname);
    const directory = join(AI_GENERATION_SOURCE_UPLOAD_DIR, jobId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, `source${extension}`);
    await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });
    return relative(AI_GENERATION_SOURCE_UPLOAD_DIR, path);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.safePath(key));
  }

  async delete(key: string | null): Promise<void> {
    if (!key) return;
    const root = resolve(AI_GENERATION_SOURCE_UPLOAD_DIR);
    const directory = resolve(this.safePath(key), '..');
    if (directory === root || !directory.startsWith(`${root}${sep}`))
      throw new Error('Thư mục tài liệu AI không hợp lệ');
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }

  private safePath(key: string): string {
    const root = resolve(AI_GENERATION_SOURCE_UPLOAD_DIR);
    const path = resolve(root, key);
    if (path !== root && path.startsWith(`${root}${sep}`)) return path;
    throw new Error('Đường dẫn tài liệu AI không hợp lệ');
  }
}
