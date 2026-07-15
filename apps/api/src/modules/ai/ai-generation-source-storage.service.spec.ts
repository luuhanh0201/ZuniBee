import { AiGenerationSourceStorageService } from './ai-generation-source-storage.service';

describe('AiGenerationSourceStorageService', () => {
  const service = new AiGenerationSourceStorageService();

  it('không cho phép khóa cấp gốc xóa toàn bộ thư mục tài liệu AI', async () => {
    await expect(service.delete('source.pdf')).rejects.toThrow(
      'Thư mục tài liệu AI không hợp lệ',
    );
  });

  it('từ chối đường dẫn thoát khỏi thư mục tài liệu AI', async () => {
    await expect(service.delete('../source.pdf')).rejects.toThrow(
      'Đường dẫn tài liệu AI không hợp lệ',
    );
  });
});
