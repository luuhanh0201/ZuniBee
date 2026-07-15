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
const MIN_DOCUMENT_TEXT = 500;
const MIN_PAGE_TEXT = 40;
const MIN_OCR_CONFIDENCE = 55;
const MAX_PDF_PAGES = 5000;
const MAX_AI_VISION_PAGES = 200;
const MAX_EXTRACTED_TEXT = 2_000_000;
export const MAX_AI_SOURCE_SIZE = 50 * 1024 * 1024;

export type AiMaterialExtraction = {
  text: string;
  pages: AiMaterialPage[];
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
  onProgress?: (progress: AiMaterialExtractionProgress) => Promise<void>;
  existingPages?: AiMaterialPage[];
  onPageExtracted?: (page: AiMaterialPage) => Promise<void>;
};

export type AiMaterialExtractionProgress = {
  totalPages: number;
  processedPages: number;
};

type OcrResult = { text: string; confidence: number };

export type AiMaterialPage = {
  pageNumber: number;
  text: string;
  method: 'direct_text' | 'text_layer' | 'local_ocr' | 'ai_vision';
  confidence: number | null;
  visionInputTokens: number;
  visionOutputTokens: number;
};

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

    const resumed = vision?.existingPages?.[0];
    if (resumed) {
      await vision?.onProgress?.({ totalPages: 1, processedPages: 1 });
      return extractionFromPages([resumed]);
    }

    const text =
      file.mimetype === 'text/plain'
        ? file.buffer.toString('utf8')
        : (await mammoth.extractRawText({ buffer: file.buffer })).value;
    const extraction = extractionFromText(text);
    await vision?.onPageExtracted?.(extraction.pages[0]);
    await vision?.onProgress?.({ totalPages: 1, processedPages: 1 });
    return extraction;
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
      pages: [],
    };
    try {
      await writeFile(pdfPath, buffer, { mode: 0o600 });
      const pages = await pdfPageCount(pdfPath);
      if (pages > MAX_PDF_PAGES)
        throw new BadRequestException(
          `Tài liệu PDF không được vượt quá ${MAX_PDF_PAGES} trang`,
        );
      await vision?.onProgress?.({ totalPages: pages, processedPages: 0 });

      const existingPages = new Map(
        (vision?.existingPages ?? []).map((page) => [page.pageNumber, page]),
      );
      const textPages =
        existingPages.size >= pages
          ? []
          : await extractPdfTextPages(pdfPath, pages);
      for (let page = 1; page <= pages; page += 1) {
        const existing = existingPages.get(page);
        if (existing) {
          appendPage(result, existing);
          await vision?.onProgress?.({
            totalPages: pages,
            processedPages: page,
          });
          continue;
        }
        const textLayer = normalizeText(textPages[page - 1] ?? '');
        let extractedPage: AiMaterialPage;
        if (textLayer.length >= MIN_PAGE_TEXT) {
          extractedPage = materialPage(page, textLayer, 'text_layer');
        } else {
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
            extractedPage = materialPage(
              page,
              normalizeText(ocr.text),
              'local_ocr',
              ocr.confidence,
            );
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
            extractedPage = materialPage(
              page,
              String(completion.value),
              'ai_vision',
              null,
              completion.inputTokens,
              completion.outputTokens,
            );
          }
          await unlink(imagePath).catch(() => undefined);
        }
        appendPage(result, extractedPage);
        await vision?.onPageExtracted?.(extractedPage);
        await vision?.onProgress?.({
          totalPages: pages,
          processedPages: page,
        });
      }

      result.text = normalizeText(result.pages.map(labelPage).join('\n')).slice(
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
  return extractionFromPages([
    materialPage(1, normalized.slice(0, MAX_EXTRACTED_TEXT), 'direct_text'),
  ]);
}

function extractionFromPages(pages: AiMaterialPage[]): AiMaterialExtraction {
  const result: AiMaterialExtraction = {
    text: '',
    pages: [],
    textLayerPages: 0,
    localOcrPages: 0,
    aiVisionPages: 0,
    visionInputTokens: 0,
    visionOutputTokens: 0,
  };
  pages.forEach((page) => appendPage(result, page));
  result.text = normalizeText(result.pages.map(labelPage).join('\n')).slice(
    0,
    MAX_EXTRACTED_TEXT,
  );
  return result;
}

function materialPage(
  pageNumber: number,
  text: string,
  method: AiMaterialPage['method'],
  confidence: number | null = null,
  visionInputTokens = 0,
  visionOutputTokens = 0,
): AiMaterialPage {
  return {
    pageNumber,
    text: normalizeText(text),
    method,
    confidence,
    visionInputTokens,
    visionOutputTokens,
  };
}

function appendPage(
  extraction: AiMaterialExtraction,
  page: AiMaterialPage,
): void {
  extraction.pages.push(page);
  if (page.method === 'text_layer') extraction.textLayerPages += 1;
  if (page.method === 'local_ocr') extraction.localOcrPages += 1;
  if (page.method === 'ai_vision') extraction.aiVisionPages += 1;
  extraction.visionInputTokens += page.visionInputTokens;
  extraction.visionOutputTokens += page.visionOutputTokens;
}

function labelPage(page: AiMaterialPage): string {
  const suffix =
    page.method === 'local_ocr'
      ? ' - OCR'
      : page.method === 'ai_vision'
        ? ' - AI đọc ảnh'
        : '';
  return `[Trang ${page.pageNumber}${suffix}] ${page.text}`;
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

async function extractPdfTextPages(
  path: string,
  expectedPages: number,
): Promise<string[]> {
  const { stdout } = await execFileAsync(
    'pdftotext',
    ['-layout', '-enc', 'UTF-8', path, '-'],
    { encoding: 'utf8', timeout: 120_000, maxBuffer: 32 * 1024 * 1024 },
  );
  const pages = stdout.split('\f');
  return Array.from(
    { length: expectedPages },
    (_, index) => pages[index] ?? '',
  );
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
      '250',
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
