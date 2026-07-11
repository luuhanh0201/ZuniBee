import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { UploadFileService } from '@/modules/upload-file/upload-file.service';
import { AVATAR_UPLOAD_DIR } from '@/modules/upload-file/upload-file.constants';

describe('UploadFileService', () => {
  it('deletes an existing local avatar', async () => {
    const filename = 'avatar-delete-test.png';
    const filePath = join(AVATAR_UPLOAD_DIR, filename);
    await mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
    await writeFile(filePath, 'test');

    await new UploadFileService().deleteLocalAvatar(
      `http://localhost:2222/uploads/avatars/${filename}`,
    );

    await expect(access(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
