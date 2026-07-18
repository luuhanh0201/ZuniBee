import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiGenerationPageFailureCategory } from '@zunibee/shared';
import * as mammoth from 'mammoth';
import { assertDeclaredFileType } from '@/modules/upload-file/upload-file-validation.util';
import { AiRequestError, isContentPolicyError } from './ai-error';
import { AiModelClientService } from './ai-model-client.service';
import { supportsPdfNativeInput } from './ai-structured-output.adapter';
import { boundedConcurrency, mapWithConcurrency } from './bounded-concurrency';
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
const DEFAULT_PAGE_CONCURRENCY = 1;
const MAX_PAGE_CONCURRENCY = 4;
const DEFAULT_PDF_BATCH_PAGES = 3;
const MAX_PDF_BATCH_PAGES = 8;
const MAX_NATIVE_PDF_BATCH_BYTES = 20 * 1024 * 1024;
export const MAX_AI_SOURCE_SIZE = 150 * 1024 * 1024;

export type AiMaterialExtraction = {
  text: string;
  pages: AiMaterialPage[];
  textLayerPages: number;
  localOcrPages: number;
  aiPdfPages: number;
  aiVisionPages: number;
  failedPages: Array<{
    pageNumber: number;
    category: AiGenerationPageFailureCategory;
  }>;
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
  /** Điểm ngắt hợp tác; gọi trước request mới và sau khi lưu checkpoint. */
  checkpoint?: () => Promise<void>;
  /** Abort signal của job để dừng request vision/PDF đang bay khi pause. */
  signal?: AbortSignal;
};

export type AiMaterialExtractionProgress = {
  totalPages: number;
  processedPages: number;
};

type OcrResult = { text: string; confidence: number };

export type AiMaterialPage = {
  pageNumber: number;
  text: string;
  method: 'direct_text' | 'text_layer' | 'local_ocr' | 'ai_pdf' | 'ai_vision';
  confidence: number | null;
  visionInputTokens: number;
  visionOutputTokens: number;
  failureCategory: AiGenerationPageFailureCategory | null;
};

@Injectable()
export class AiMaterialSourceService {
  private readonly logger = new Logger(AiMaterialSourceService.name);
  /** Kết quả kiểm tra Tesseract, memoize cho cả vòng đời process. */
  private localOcrAvailability?: Promise<boolean>;

  constructor(
    private readonly client: AiModelClientService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private pageConcurrency(): number {
    return boundedConcurrency(
      this.config?.get<string | number>('AI_DOCUMENT_PAGE_CONCURRENCY'),
      DEFAULT_PAGE_CONCURRENCY,
      MAX_PAGE_CONCURRENCY,
    );
  }

  private pdfBatchPages(): number {
    return boundedConcurrency(
      this.config?.get<string | number>('AI_DOCUMENT_PDF_BATCH_PAGES'),
      DEFAULT_PDF_BATCH_PAGES,
      MAX_PDF_BATCH_PAGES,
    );
  }

  private localOcrEnabled(): boolean {
    return configBoolean(
      this.config?.get<string | boolean>('AI_DOCUMENT_LOCAL_OCR_ENABLED'),
      false,
    );
  }

  private nativePdfEnabled(): boolean {
    return configBoolean(
      this.config?.get<string | boolean>('AI_DOCUMENT_PDF_NATIVE_ENABLED'),
      true,
    );
  }

  /**
   * Kiểm tra Tesseract đúng một lần trước batch đầu tiên. Máy không cài
   * Tesseract chỉ ghi một cảnh báo rồi mọi trang scan đi thẳng AI vision,
   * không spawn ENOENT lặp lại trên từng trang.
   */
  private localOcrAvailable(): Promise<boolean> {
    this.localOcrAvailability ??= this.localOcrEnabled()
      ? execFileAsync('tesseract', ['--version'], {
          encoding: 'utf8',
          timeout: 10_000,
          maxBuffer: 1024 * 1024,
        }).then(
          () => true,
          (error: unknown) => {
            this.logger.warn(
              `Local OCR không khả dụng (chưa cài Tesseract?), mọi trang scan sẽ dùng AI vision: ${safeError(error)}`,
            );
            return false;
          },
        )
      : Promise.resolve(false);
    return this.localOcrAvailability;
  }

  async extract(
    file: Express.Multer.File | undefined,
    vision?: AiMaterialVisionContext,
  ): Promise<AiMaterialExtraction> {
    if (!file) throw new BadRequestException('Vui lòng tải lên tài liệu nguồn');
    if (file.size > MAX_AI_SOURCE_SIZE)
      throw new BadRequestException('Tài liệu AI không được vượt quá 150 MB');
    if (!SUPPORTED_MIME_TYPES.has(file.mimetype))
      throw new BadRequestException('Tài liệu AI chỉ hỗ trợ TXT, DOCX và PDF');
    assertDeclaredFileType(file);

    if (file.mimetype === 'application/pdf')
      return this.extractPdf(file.buffer, vision);

    const resumed = vision?.existingPages?.[0];
    if (resumed) {
      await vision?.onProgress?.({ totalPages: 1, processedPages: 1 });
      await vision?.checkpoint?.();
      return extractionFromPages([resumed]);
    }

    const text =
      file.mimetype === 'text/plain'
        ? file.buffer.toString('utf8')
        : (await mammoth.extractRawText({ buffer: file.buffer })).value;
    const extraction = extractionFromText(text);
    await vision?.onPageExtracted?.(extraction.pages[0]);
    await vision?.onProgress?.({ totalPages: 1, processedPages: 1 });
    await vision?.checkpoint?.();
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
      aiPdfPages: 0,
      aiVisionPages: 0,
      failedPages: [],
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
      const existingPages = new Map(
        (vision?.existingPages ?? [])
          .filter((page) => page.pageNumber >= 1 && page.pageNumber <= pages)
          .map((page) => [page.pageNumber, page]),
      );
      const textPages =
        existingPages.size >= pages
          ? []
          : await extractPdfTextPages(pdfPath, pages);
      let processedPages = existingPages.size;
      const claimedAiPages = new Set(
        [...existingPages.values()]
          .filter(
            (page) => page.method === 'ai_pdf' || page.method === 'ai_vision',
          )
          .map((page) => page.pageNumber),
      );
      let progressTail = Promise.resolve();
      const reportProgress = async (processed: number) => {
        const update = progressTail.then(() =>
          vision?.onProgress?.({
            totalPages: pages,
            processedPages: processed,
          }),
        );
        progressTail = update.catch(() => undefined);
        await update;
      };
      const reserveAiPage = (pageNumber: number) => {
        if (claimedAiPages.has(pageNumber)) return;
        if (claimedAiPages.size >= MAX_AI_VISION_PAGES)
          throw new BadRequestException(
            `Tài liệu có quá nhiều trang cần AI đọc; tối đa ${MAX_AI_VISION_PAGES} trang mỗi lần`,
          );
        claimedAiPages.add(pageNumber);
      };
      const completePage = async (page: AiMaterialPage) => {
        await vision?.onPageExtracted?.(page);
        processedPages += 1;
        await reportProgress(processedPages);
        await vision?.checkpoint?.();
        return page;
      };

      await reportProgress(processedPages);
      await vision?.checkpoint?.();
      const missingPageNumbers = Array.from(
        { length: pages },
        (_, index) => index + 1,
      ).filter((pageNumber) => !existingPages.has(pageNumber));
      const textLayerPageNumbers = missingPageNumbers.filter((pageNumber) =>
        isUsableTextLayer(textPages[pageNumber - 1] ?? ''),
      );
      const scanPageNumbers = missingPageNumbers.filter(
        (pageNumber) => !textLayerPageNumbers.includes(pageNumber),
      );
      const directPages = await mapWithConcurrency(
        textLayerPageNumbers,
        this.pageConcurrency(),
        async (pageNumber) => {
          await vision?.checkpoint?.();
          return completePage(
            materialPage(
              pageNumber,
              normalizeText(textPages[pageNumber - 1] ?? ''),
              'text_layer',
            ),
          );
        },
      );
      let scannedPages: AiMaterialPage[] = [];
      if (scanPageNumbers.length) {
        if (!vision)
          throw new BadRequestException(
            'Trang scan cần provider AI đọc PDF/ảnh nhưng chưa được cấu hình',
          );
        const useNativePdf =
          this.nativePdfEnabled() && supportsPdfNativeInput(vision.provider);
        if (useNativePdf) {
          const batches = buildPdfPageBatches(
            scanPageNumbers,
            this.pdfBatchPages(),
          );
          const batchResults = await mapWithConcurrency(
            batches,
            this.pageConcurrency(),
            async (pageNumbers) => {
              await vision.checkpoint?.();
              pageNumbers.forEach(reserveAiPage);
              try {
                const extracted = await this.extractNativePdfBatch({
                  pdfPath,
                  directory,
                  pageNumbers,
                  vision,
                });
                const completed: AiMaterialPage[] = [];
                for (const page of extracted)
                  completed.push(await completePage(page));
                return completed;
              } catch (error) {
                if (!shouldFallbackPdfToImages(error)) throw error;
                this.logger.warn(
                  `AI PDF native không dùng được; fallback ảnh cho pages=[${pageNumbers.join(',')}]: ${safeError(error)}`,
                );
                const completed: AiMaterialPage[] = [];
                for (const pageNumber of pageNumbers) {
                  await vision.checkpoint?.();
                  const page = await this.extractPdfPage({
                    pdfPath,
                    directory,
                    pageNumber,
                    textLayer: '',
                    vision,
                    reserveAiPage,
                  });
                  completed.push(await completePage(page));
                }
                return completed;
              }
            },
          );
          scannedPages = batchResults.flat();
        } else {
          scannedPages = await mapWithConcurrency(
            scanPageNumbers,
            this.pageConcurrency(),
            async (pageNumber) => {
              await vision.checkpoint?.();
              return completePage(
                await this.extractPdfPage({
                  pdfPath,
                  directory,
                  pageNumber,
                  textLayer: '',
                  vision,
                  reserveAiPage,
                }),
              );
            },
          );
        }
      }
      const extractedPages = [...directPages, ...scannedPages];

      [...existingPages.values(), ...extractedPages]
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .forEach((page) => appendPage(result, page));

      result.text = normalizeText(result.pages.map(labelPage).join('\n')).slice(
        0,
        MAX_EXTRACTED_TEXT,
      );
      const extractedTextLength = result.pages.reduce(
        (total, page) => total + normalizeText(page.text).length,
        0,
      );
      if (extractedTextLength < MIN_DOCUMENT_TEXT)
        throw new BadRequestException(
          'Tài liệu không có đủ nội dung chữ để sinh quiz',
        );
      this.logger.log(
        `PDF extraction completed: pages=${pages} textLayerPages=${result.textLayerPages} localOcrPages=${result.localOcrPages} aiPdfPages=${result.aiPdfPages} aiVisionPages=${result.aiVisionPages} failedPages=${result.failedPages.length} visionInputTokens=${result.visionInputTokens} visionOutputTokens=${result.visionOutputTokens}`,
      );
      return result;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async extractPdfPage(args: {
    pdfPath: string;
    directory: string;
    pageNumber: number;
    textLayer: string;
    vision?: AiMaterialVisionContext;
    reserveAiPage: (pageNumber: number) => void;
  }): Promise<AiMaterialPage> {
    const { pageNumber, textLayer, vision } = args;
    if (textLayer.length >= MIN_PAGE_TEXT)
      return materialPage(pageNumber, textLayer, 'text_layer');

    const imagePath = await renderPdfPage(
      args.pdfPath,
      args.directory,
      pageNumber,
    );
    try {
      let ocr: OcrResult | null = null;
      if (await this.localOcrAvailable()) {
        try {
          ocr = await runLocalOcr(imagePath);
        } catch (error) {
          this.logger.warn(
            `Local OCR failed: page=${pageNumber} reason=${safeError(error)}`,
          );
        }
      }
      if (ocr && isUsableOcr(ocr))
        return materialPage(
          pageNumber,
          normalizeText(ocr.text),
          'local_ocr',
          ocr.confidence,
        );

      if (!vision)
        throw new BadRequestException(
          'Trang scan cần AI vision nhưng chưa có provider AI để xử lý',
        );
      args.reserveAiPage(pageNumber);
      this.logger.warn(
        `Falling back to AI vision OCR: provider=${vision.provider.name} model=${vision.provider.model} page=${pageNumber} localConfidence=${ocr?.confidence.toFixed(1) ?? 'unavailable'}`,
      );
      return await this.extractVisionPage(
        vision,
        await readFile(imagePath),
        pageNumber,
      );
    } finally {
      await unlink(imagePath).catch(() => undefined);
    }
  }

  private async extractNativePdfBatch(args: {
    pdfPath: string;
    directory: string;
    pageNumbers: number[];
    vision: AiMaterialVisionContext;
  }): Promise<AiMaterialPage[]> {
    const batchPath = join(
      args.directory,
      `native-${args.pageNumbers[0]}-${args.pageNumbers.at(-1)}.pdf`,
    );
    const startedAt = Date.now();
    await createOptimizedPdfRange(args.pdfPath, batchPath, args.pageNumbers);
    try {
      const pdf = await readFile(batchPath);
      if (pdf.length > MAX_NATIVE_PDF_BATCH_BYTES)
        throw new Error(
          `PDF batch sau nén vẫn vượt ${MAX_NATIVE_PDF_BATCH_BYTES / 1024 / 1024} MB`,
        );
      const completion = await this.client.readPdfPagesText(
        args.vision.provider,
        pdf,
        args.pageNumbers,
        {
          source: 'document_vision_ocr',
          referenceId: args.vision.referenceId,
          userId: args.vision.userId,
          abortSignal: args.vision.signal,
        },
      );
      const inputTokens = distributeInteger(
        completion.inputTokens,
        args.pageNumbers.length,
      );
      const outputTokens = distributeInteger(
        completion.outputTokens,
        args.pageNumbers.length,
      );
      this.logger.log(
        `Native PDF batch completed: pages=[${args.pageNumbers.join(',')}] bytes=${pdf.length} latencyMs=${Date.now() - startedAt}`,
      );
      return args.pageNumbers.map((pageNumber, index) => {
        const text = completion.pages.get(pageNumber) ?? '';
        return materialPage(
          pageNumber,
          text,
          'ai_pdf',
          null,
          inputTokens[index],
          outputTokens[index],
          text.length >= MIN_PAGE_TEXT ? null : 'needs_manual_review',
        );
      });
    } finally {
      await unlink(batchPath).catch(() => undefined);
    }
  }

  /**
   * Content filter chỉ làm mất nội dung của đúng một trang. Lưu checkpoint
   * rỗng để job tiếp tục và không gửi lại trang đó khi queue resume; các lỗi
   * quota, mạng, schema và model không hỗ trợ ảnh vẫn được ném ra như cũ.
   */
  private async extractVisionPage(
    vision: AiMaterialVisionContext,
    image: Buffer,
    pageNumber: number,
  ): Promise<AiMaterialPage> {
    try {
      const completion = await this.client.readImageText(
        vision.provider,
        image,
        'image/png',
        {
          source: 'document_vision_ocr',
          referenceId: vision.referenceId,
          userId: vision.userId,
          abortSignal: vision.signal,
        },
        pageNumber,
      );
      return materialPage(
        pageNumber,
        String(completion.value),
        'ai_vision',
        null,
        completion.inputTokens,
        completion.outputTokens,
      );
    } catch (error) {
      if (isContentPolicyError(error)) {
        this.logger.warn(
          `Bỏ qua trang bị vision provider chặn bởi content policy: provider=${vision.provider.name} model=${vision.provider.model} page=${pageNumber} referenceId=${vision.referenceId}`,
        );
        return materialPage(
          pageNumber,
          '',
          'ai_vision',
          null,
          0,
          0,
          'provider_blocked',
        );
      }
      if (error instanceof AiRequestError && !error.details.retryable) {
        const category: AiGenerationPageFailureCategory =
          error.details.category === 'provider_schema_error'
            ? 'unsupported_input'
            : error.details.category === 'invalid_json_output'
              ? 'invalid_output'
              : 'needs_manual_review';
        this.logger.warn(
          `Bỏ qua trang AI vision không đọc được: provider=${vision.provider.name} model=${vision.provider.model} page=${pageNumber} category=${category} reason=${safeError(error)}`,
        );
        return materialPage(pageNumber, '', 'ai_vision', null, 0, 0, category);
      }
      throw error;
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
    aiPdfPages: 0,
    aiVisionPages: 0,
    failedPages: [],
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
  failureCategory: AiGenerationPageFailureCategory | null = null,
): AiMaterialPage {
  return {
    pageNumber,
    text: normalizeText(text),
    method,
    confidence,
    visionInputTokens,
    visionOutputTokens,
    failureCategory,
  };
}

function appendPage(
  extraction: AiMaterialExtraction,
  page: AiMaterialPage,
): void {
  extraction.pages.push(page);
  if (page.method === 'text_layer') extraction.textLayerPages += 1;
  if (page.method === 'local_ocr') extraction.localOcrPages += 1;
  if (page.method === 'ai_pdf') extraction.aiPdfPages += 1;
  if (page.method === 'ai_vision') extraction.aiVisionPages += 1;
  if (page.failureCategory)
    extraction.failedPages.push({
      pageNumber: page.pageNumber,
      category: page.failureCategory,
    });
  extraction.visionInputTokens += page.visionInputTokens;
  extraction.visionOutputTokens += page.visionOutputTokens;
}

function labelPage(page: AiMaterialPage): string {
  const suffix =
    page.method === 'local_ocr'
      ? ' - OCR'
      : page.method === 'ai_pdf'
        ? ' - AI đọc PDF'
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

export function buildPdfPageBatches(
  pageNumbers: number[],
  maximumPages: number,
): number[][] {
  const limit = Math.max(1, Math.floor(maximumPages));
  const sorted = [...new Set(pageNumbers)].sort((a, b) => a - b);
  const batches: number[][] = [];
  for (const pageNumber of sorted) {
    const current = batches.at(-1);
    if (
      !current ||
      current.length >= limit ||
      pageNumber !== current[current.length - 1] + 1
    ) {
      batches.push([pageNumber]);
    } else {
      current.push(pageNumber);
    }
  }
  return batches;
}

/**
 * Tạo một PDF page-range hợp lệ và tối ưu ảnh ngay trong PDF. Không raster
 * trang thành PNG tại ZuniBee; Ghostscript chỉ downsample/recompress asset để
 * payload gửi provider nhỏ hơn. `pageNumbers` luôn liên tiếp do batch builder.
 */
async function createOptimizedPdfRange(
  sourcePath: string,
  outputPath: string,
  pageNumbers: number[],
): Promise<void> {
  const firstPage = pageNumbers[0];
  const lastPage = pageNumbers.at(-1);
  if (!firstPage || !lastPage)
    throw new Error('PDF batch không có trang để xử lý');
  for (let index = 1; index < pageNumbers.length; index += 1) {
    if (pageNumbers[index] !== pageNumbers[index - 1] + 1)
      throw new Error('PDF batch phải gồm các trang liên tiếp');
  }
  await execFileAsync(
    'gs',
    [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.6',
      '-dPDFSETTINGS=/ebook',
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      '-dSubsetFonts=true',
      '-dDownsampleColorImages=true',
      '-dColorImageResolution=180',
      '-dDownsampleGrayImages=true',
      '-dGrayImageResolution=180',
      '-dDownsampleMonoImages=true',
      '-dMonoImageResolution=300',
      `-dFirstPage=${firstPage}`,
      `-dLastPage=${lastPage}`,
      `-sOutputFile=${outputPath}`,
      sourcePath,
    ],
    { encoding: 'utf8', timeout: 120_000, maxBuffer: 2 * 1024 * 1024 },
  );
}

export function distributeInteger(total: number, count: number): number[] {
  if (count < 1) return [];
  const safeTotal = Math.max(0, Math.floor(total));
  const base = Math.floor(safeTotal / count);
  const remainder = safeTotal % count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function shouldFallbackPdfToImages(error: unknown): boolean {
  return !(error instanceof AiRequestError) || !error.details.retryable;
}

export function isUsableTextLayer(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length < MIN_PAGE_TEXT) return false;
  const meaningful = normalized.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  return meaningful / normalized.length >= 0.25;
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

function configBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}
