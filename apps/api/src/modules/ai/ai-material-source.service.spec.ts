import { AiMaterialSourceService } from './ai-material-source.service';

describe('AiMaterialSourceService', () => {
  const service = new AiMaterialSourceService();
  function file(content: string, mimetype = 'text/plain'): Express.Multer.File {
    const buffer = Buffer.from(content);
    return {
      fieldname: 'file',
      originalname: 'source.txt',
      encoding: '7bit',
      mimetype,
      size: buffer.length,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: null as never,
    };
  }

  it('extracts normalized text from a direct upload', async () => {
    await expect(
      service.extract(
        file(
          'Đây là nội dung tài liệu đủ dài để hệ thống tạo câu hỏi.  Nội dung có nhiều khoảng trắng.',
        ),
      ),
    ).resolves.toBe(
      'Đây là nội dung tài liệu đủ dài để hệ thống tạo câu hỏi. Nội dung có nhiều khoảng trắng.',
    );
  });

  it('rejects missing and unsupported uploads before calling AI', async () => {
    await expect(service.extract(undefined)).rejects.toThrow(
      'Vui lòng tải lên',
    );
    await expect(
      service.extract(
        file(
          'Nội dung đủ dài nhưng loại tệp không được hỗ trợ bởi luồng AI.',
          'image/png',
        ),
      ),
    ).rejects.toThrow('chỉ hỗ trợ TXT, DOCX và PDF');
  });
});
