import {
  AiMaterialSourceService,
  isUsableOcr,
  parseTesseractTsv,
} from './ai-material-source.service';

describe('AiMaterialSourceService', () => {
  const service = new AiMaterialSourceService({
    readImageText: jest.fn(),
  } as never);
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
    ).resolves.toMatchObject({
      text: 'Đây là nội dung tài liệu đủ dài để hệ thống tạo câu hỏi. Nội dung có nhiều khoảng trắng.',
      aiVisionPages: 0,
      visionInputTokens: 0,
      visionOutputTokens: 0,
    });
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

  it('đánh giá OCR theo độ dài và confidence trung bình', () => {
    const header =
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
    const rows = Array.from(
      { length: 12 },
      (_, index) =>
        `5\t1\t1\t1\t1\t${index + 1}\t0\t0\t10\t10\t90\tNội_dung_${index + 1}`,
    );
    const parsed = parseTesseractTsv([header, ...rows].join('\n'));

    expect(parsed.confidence).toBe(90);
    expect(isUsableOcr(parsed)).toBe(true);
    expect(isUsableOcr({ text: parsed.text, confidence: 20 })).toBe(false);
  });
});
