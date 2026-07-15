import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { assertDeclaredFileType } from '@/modules/upload-file/upload-file-validation.util';
import { AiModelClientService } from './ai-model-client.service';
import type { AiProviderEntity } from './entities/ai-provider.entity';

const execFileAsync = promisify(execFile);
const SUPPORTED_MIME_TYPES = new Set([
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MIN_DOCUMENT_TEXT = 50;
const MIN_PAGE_TEXT = 40;
const MIN_OCR_CONFIDENCE = 55;
const MAX_PDF_PAGES = 50;
const MAX_AI_VISION_PAGES = 10;
const MAX_EXTRACTED_TEXT = 60_000;
export const MAX_AI_SOURCE_SIZE = 50 * 1024 * 1024;

export type AiMaterialExtraction = {
  text: string;
  textLayerPages: number;
  localOcrPages: number;
  aiVisionPages: number;
  visionInputTokens: number;
  visionOutputTokens: number;
};

export type AiMaterialVisionContext = {
  provider: AiProviderEntity;
  referenceId: string;
  userId: string;
};

type OcrResult = { text: string; confidence: number };

@Injectable()
export class AiMaterialSourceService {
  private readonly logger = new Logger(AiMaterialSourceService.name);

  constructor(private readonly client: AiModelClientService) {}

  async extract(
    file: Express.Multer.File | undefined,
    vision?: AiMaterialVisionContext,
  ): Promise<AiMaterialExtraction> {
    if (!file) throw new BadRequestException('Vui lòng tải lên tài liệu nguồn');
    if (file.size > MAX_AI_SOURCE_SIZE)
      throw new BadRequestException('Tài liệu AI không được vượt quá 50 MB');
    if (!SUPPORTED_MIME_TYPES.has(file.mimetype))
      throw new BadRequestException('Tài liệu AI chỉ hỗ trợ TXT, DOCX và PDF');
    assertDeclaredFileType(file);

    if (file.mimetype === 'application/pdf')
      return this.extractPdf(file.buffer, vision);

    const text =
      file.mimetype === 'text/plain'
        ? file.buffer.toString('utf8')
        : (await mammoth.extractRawText({ buffer: file.buffer })).value;
    return extractionFromText(text);
  }

  private async extractPdf(
    buffer: Buffer,
    vision?: AiMaterialVisionContext,
  ): Promise<AiMaterialExtraction> {
    const directory = await mkdtemp(join(tmpdir(), 'zunibee-ai-pdf-'));
    const pdfPath = join(directory, 'source.pdf');
    const result: AiMaterialExtraction = {
      text: '',
      textLayerPages: 0,
      localOcrPages: 0,
      aiVisionPages: 0,
      visionInputTokens: 0,
      visionOutputTokens: 0,
    };
    try {
      await writeFile(pdfPath, buffer, { mode: 0o600 });
      const pages = await pdfPageCount(pdfPath);
      if (pages > MAX_PDF_PAGES)
        throw new BadRequestException(
          `Tài liệu PDF không được vượt quá ${MAX_PDF_PAGES} trang`,
        );

      const pageTexts: string[] = [];
      for (let page = 1; page <= pages; page += 1) {
        const textLayer = normalizeText(
          await extractPdfTextPage(pdfPath, page),
        );
        if (textLayer.length >= MIN_PAGE_TEXT) {
          pageTexts.push(`[Trang ${page}] ${textLayer}`);
          result.textLayerPages += 1;
          if (pageTexts.join(' ').length >= MAX_EXTRACTED_TEXT) break;
          continue;
        }

        const imagePath = await renderPdfPage(pdfPath, directory, page);
        let ocr: OcrResult | null = null;
        try {
          ocr = await runLocalOcr(imagePath);
        } catch (error) {
          this.logger.warn(
            `Local OCR unavailable: page=${page} reason=${safeError(error)}`,
          );
        }

        if (ocr && isUsableOcr(ocr)) {
          pageTexts.push(`[Trang ${page} - OCR] ${normalizeText(ocr.text)}`);
          result.localOcrPages += 1;
        } else {
          if (!vision)
            throw new BadRequestException(
              'Trang scan cần AI vision nhưng chưa có provider AI để xử lý',
            );
          if (result.aiVisionPages >= MAX_AI_VISION_PAGES)
            throw new BadRequestException(
              `Tài liệu có quá nhiều trang cần AI đọc ảnh; tối đa ${MAX_AI_VISION_PAGES} trang mỗi lần`,
            );
          this.logger.warn(
            `Falling back to AI vision OCR: provider=${vision.provider.name} model=${vision.provider.model} page=${page} localConfidence=${ocr?.confidence.toFixed(1) ?? 'unavailable'}`,
          );
          const completion = await this.client.readImageText(
            vision.provider,
            await readFile(imagePath),
            'image/png',
            {
              source: 'document_vision_ocr',
              referenceId: vision.referenceId,
              userId: vision.userId,
            },
            page,
          );
          pageTexts.push(
            `[Trang ${page} - AI đọc ảnh] ${String(completion.value)}`,
          );
          result.aiVisionPages += 1;
          result.visionInputTokens += completion.inputTokens;
          result.visionOutputTokens += completion.outputTokens;
        }
        await unlink(imagePath).catch(() => undefined);
        if (pageTexts.join(' ').length >= MAX_EXTRACTED_TEXT) break;
      }

      result.text = normalizeText(pageTexts.join('\n')).slice(
        0,
        MAX_EXTRACTED_TEXT,
      );
      if (result.text.length < MIN_DOCUMENT_TEXT)
        throw new BadRequestException(
          'Tài liệu không có đủ nội dung chữ để sinh quiz',
        );
      this.logger.log(
        `PDF extraction completed: pages=${pages} textLayerPages=${result.textLayerPages} localOcrPages=${result.localOcrPages} aiVisionPages=${result.aiVisionPages} visionInputTokens=${result.visionInputTokens} visionOutputTokens=${result.visionOutputTokens}`,
      );
      return result;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

function extractionFromText(text: string): AiMaterialExtraction {
  const normalized = normalizeText(text);
  if (normalized.length < MIN_DOCUMENT_TEXT)
    throw new BadRequestException(
      'Tài liệu không có đủ nội dung chữ để sinh quiz',
    );
  return {
    text: normalized.slice(0, MAX_EXTRACTED_TEXT),
    textLayerPages: 0,
    localOcrPages: 0,
    aiVisionPages: 0,
    visionInputTokens: 0,
    visionOutputTokens: 0,
  };
}

async function pdfPageCount(path: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('pdfinfo', [path], {
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });
    const match = /^Pages:\s+(\d+)$/im.exec(stdout);
    const pages = Number(match?.[1]);
    if (!Number.isInteger(pages) || pages < 1)
      throw new Error('Không xác định được số trang');
    return pages;
  } catch (error) {
    throw new BadRequestException(`Không thể đọc PDF: ${safeError(error)}`);
  }
}

async function extractPdfTextPage(path: string, page: number): Promise<string> {
  const { stdout } = await execFileAsync(
    'pdftotext',
    [
      '-f',
      String(page),
      '-l',
      String(page),
      '-layout',
      '-enc',
      'UTF-8',
      path,
      '-',
    ],
    { encoding: 'utf8', timeout: 20_000, maxBuffer: 2 * 1024 * 1024 },
  );
  return stdout;
}

async function renderPdfPage(
  pdfPath: string,
  directory: string,
  page: number,
): Promise<string> {
  const outputRoot = join(directory, `page-${page}`);
  await execFileAsync(
    'pdftoppm',
    [
      '-f',
      String(page),
      '-l',
      String(page),
      '-singlefile',
      '-png',
      '-r',
      '160',
      pdfPath,
      outputRoot,
    ],
    { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 },
  );
  return `${outputRoot}.png`;
}

async function runLocalOcr(imagePath: string): Promise<OcrResult> {
  const { stdout } = await execFileAsync(
    'tesseract',
    [imagePath, 'stdout', '-l', 'vie+eng', '--psm', '6', 'tsv'],
    { encoding: 'utf8', timeout: 45_000, maxBuffer: 8 * 1024 * 1024 },
  );
  return parseTesseractTsv(stdout);
}

export function parseTesseractTsv(tsv: string): OcrResult {
  const rows = tsv.trim().split(/\r?\n/).slice(1);
  const words: string[] = [];
  const confidences: number[] = [];
  for (const row of rows) {
    const columns = row.split('\t');
    const confidence = Number(columns[10]);
    const text = columns.slice(11).join('\t').trim();
    if (!text || !Number.isFinite(confidence) || confidence < 0) continue;
    words.push(text);
    confidences.push(confidence);
  }
  return {
    text: words.join(' '),
    confidence: confidences.length
      ? confidences.reduce((total, value) => total + value, 0) /
        confidences.length
      : 0,
  };
}

export function isUsableOcr(result: OcrResult): boolean {
  return (
    normalizeText(result.text).length >= MIN_PAGE_TEXT &&
    result.confidence >= MIN_OCR_CONFIDENCE
  );
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}
