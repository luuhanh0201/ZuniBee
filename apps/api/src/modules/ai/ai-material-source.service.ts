import { BadRequestException, Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

const SUPPORTED_MIME_TYPES = new Set([
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
export const MAX_AI_SOURCE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class AiMaterialSourceService {
  async extract(file: Express.Multer.File | undefined): Promise<string> {
    if (!file) throw new BadRequestException('Vui lòng tải lên tài liệu nguồn');
    if (file.size > MAX_AI_SOURCE_SIZE)
      throw new BadRequestException('Tài liệu AI không được vượt quá 10 MB');
    if (!SUPPORTED_MIME_TYPES.has(file.mimetype))
      throw new BadRequestException('Tài liệu AI chỉ hỗ trợ TXT, DOCX và PDF');

    let text = '';
    if (file.mimetype === 'text/plain') text = file.buffer.toString('utf8');
    else if (
      file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
      text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    else if (file.mimetype === 'application/pdf')
      text = (await pdfParse(file.buffer)).text;

    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length < 50)
      throw new BadRequestException(
        'Tài liệu không có đủ nội dung chữ để sinh quiz',
      );
    return normalized.slice(0, 60_000);
  }
}
