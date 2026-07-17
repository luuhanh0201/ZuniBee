import {
  AiMaterialSourceService,
  buildPdfPageBatches,
  distributeInteger,
  isUsableOcr,
  isUsableTextLayer,
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
    const source = `${'Đây là nội dung tài liệu đủ dài để hệ thống tạo câu hỏi. '.repeat(12)} Nội dung có nhiều khoảng trắng.`;
    await expect(service.extract(file(source))).resolves.toMatchObject({
      pages: [
        expect.objectContaining({ pageNumber: 1, method: 'direct_text' }),
      ],
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
      { length: 50 },
      (_, index) =>
        `5\t1\t1\t1\t1\t${index + 1}\t0\t0\t10\t10\t90\tNội_dung_${index + 1}`,
    );
    const parsed = parseTesseractTsv([header, ...rows].join('\n'));

    expect(parsed.confidence).toBe(90);
    expect(isUsableOcr(parsed)).toBe(true);
    expect(isUsableOcr({ text: parsed.text, confidence: 20 })).toBe(false);
  });

  it('uses safe page concurrency defaults and caps env overrides', () => {
    const configured = new AiMaterialSourceService(
      {} as never,
      {
        get: jest.fn().mockReturnValue(99),
      } as never,
    );
    const empty = new AiMaterialSourceService(
      {} as never,
      {
        get: jest.fn().mockReturnValue(''),
      } as never,
    );
    expect(configured['pageConcurrency']()).toBe(4);
    expect(empty['pageConcurrency']()).toBe(1);
  });

  it('groups only consecutive PDF pages and respects the batch cap', () => {
    expect(buildPdfPageBatches([7, 1, 2, 3, 5, 6, 8, 9], 3)).toEqual([
      [1, 2, 3],
      [5, 6, 7],
      [8, 9],
    ]);
  });

  it('distributes PDF usage tokens without losing or double-counting', () => {
    const values = distributeInteger(10, 3);
    expect(values).toEqual([4, 3, 3]);
    expect(values.reduce((total, value) => total + value, 0)).toBe(10);
  });

  it('rejects noisy text layers instead of treating symbols as source text', () => {
    expect(isUsableTextLayer('%%% --- ___ ### '.repeat(10))).toBe(false);
    expect(
      isUsableTextLayer(
        'Unit 1. Students learn vocabulary and grammar in context. '.repeat(3),
      ),
    ).toBe(true);
  });

  it('defaults to native PDF with local Tesseract disabled', () => {
    expect(service['nativePdfEnabled']()).toBe(true);
    expect(service['localOcrEnabled']()).toBe(false);
    expect(service['pdfBatchPages']()).toBe(3);
  });
});
