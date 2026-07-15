import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  AiGenerationJob,
  GenerateQuizWithAiResponse,
  QuizQuestionType as SharedQuestionType,
} from '@zunibee/shared';
import {
  generationOutputSchema,
  generationSystemPrompt,
  generationUserPrompt,
} from '@/modules/ai/prompts/quiz-generation.prompt';
import {
  chunkAnalysisOutputSchema,
  chunkAnalysisSystemPrompt,
  chunkAnalysisUserPrompt,
  qualityCandidateSystemPrompt,
  qualityCandidateUserPrompt,
  qualityQuestionsOutputSchema,
  qualityReviewSystemPrompt,
  qualityReviewUserPrompt,
  quizBlueprintOutputSchema,
  quizBlueprintSystemPrompt,
  quizBlueprintUserPrompt,
  type CognitiveDistribution,
  type QualityQuestion,
  type QuizBlueprint,
  type QuizChunkAnalysis,
} from '@/modules/ai/prompts/quiz-quality.prompt';
import { QuizService } from '@/modules/quiz/quiz.service';
import { QuizQuestionType } from '@/modules/quiz/entities/quiz-question.entity';
import { AiProviderService } from './ai-provider.service';
import { AiCreditService } from './ai-credit.service';
import { AiModelClientService } from './ai-model-client.service';
import {
  AiMaterialSourceService,
  type AiMaterialPage,
} from './ai-material-source.service';
import { AiGenerationSourceStorageService } from './ai-generation-source-storage.service';
import { AiGenerationQueueService } from './ai-generation-queue.service';
import {
  AiGenerationJobEntity,
  AiGenerationJobStage,
  AiGenerationJobStatus,
} from './entities/ai-generation-job.entity';
import {
  AiDocumentPageExtractionMethod,
  AiGenerationDocumentPageEntity,
} from './entities/ai-generation-document-page.entity';
import {
  AiGenerationChunkEntity,
  AiGenerationChunkStatus,
} from './entities/ai-generation-chunk.entity';
import { GenerateQuizWithAiDto } from './dto/generate-quiz-with-ai.dto';

type GeneratedQuestion = {
  type: SharedQuestionType;
  content: string;
  explanation?: string;
  options: Array<{ content: string; isCorrect: boolean }>;
};

type DocumentChunk = {
  chunkIndex: number;
  startPage: number | null;
  endPage: number | null;
  text: string;
};

const MAX_GENERATION_CHUNKS = 40;
const TARGET_CHUNK_CHARACTERS = 24_000;
const MAX_CHUNK_SOURCE_CHARACTERS = 2_000_000;

@Injectable()
export class AiQuizGenerationService {
  private readonly logger = new Logger(AiQuizGenerationService.name);

  constructor(
    @InjectRepository(AiGenerationJobEntity)
    private readonly jobs: Repository<AiGenerationJobEntity>,
    @InjectRepository(AiGenerationDocumentPageEntity)
    private readonly documentPages: Repository<AiGenerationDocumentPageEntity>,
    @InjectRepository(AiGenerationChunkEntity)
    private readonly chunks: Repository<AiGenerationChunkEntity>,
    private readonly providers: AiProviderService,
    private readonly credits: AiCreditService,
    private readonly client: AiModelClientService,
    private readonly materialSource: AiMaterialSourceService,
    private readonly sourceStorage: AiGenerationSourceStorageService,
    private readonly queue: AiGenerationQueueService,
    private readonly quizzes: QuizService,
  ) {}

  async generate(
    teacherId: string,
    dto: GenerateQuizWithAiDto,
    sourceFile?: Express.Multer.File,
  ): Promise<GenerateQuizWithAiResponse> {
    const existing = dto.jobId
      ? await this.jobs.findOne({ where: { id: dto.jobId } })
      : null;
    if (existing) {
      if (existing.teacherId !== teacherId)
        throw new NotFoundException('Tác vụ sinh quiz không tồn tại');
      const provider = await this.providers
        .resolve(existing.providerId)
        .catch(() => null);
      return {
        job: this.toResponse(existing, provider?.name ?? 'Provider đã tắt'),
        credit: await this.credits.get(teacherId),
      };
    }

    const sourceType = dto.sourceType ?? 'prompt';
    if (sourceType === 'upload' && !sourceFile)
      throw new BadRequestException('Vui lòng tải lên tài liệu nguồn');
    const provider = await this.providers.resolveQuiz();
    const visionProvider =
      sourceType === 'upload' ? await this.providers.resolveVision() : null;
    const reserved = estimateReservedCredits(
      provider.baseCreditCost,
      provider.creditCostPer1kTokens,
      dto.questionCount,
    );
    let job = await this.jobs.save(
      this.jobs.create({
        ...(dto.jobId ? { id: dto.jobId } : {}),
        teacherId,
        providerId: provider.id,
        visionProviderId: visionProvider?.id ?? null,
        quizId: null,
        status: AiGenerationJobStatus.PENDING,
        stage: AiGenerationJobStage.QUEUED,
        documentTotalPages: null,
        documentProcessedPages: 0,
        generationTotalChunks: null,
        generationProcessedChunks: 0,
        sourceStorageKey: null,
        sourceOriginalName: sourceFile?.originalname.slice(0, 255) ?? null,
        sourceMimeType: sourceFile?.mimetype ?? null,
        sourceSize: sourceFile?.size ?? null,
        attemptCount: 0,
        quizBlueprint: null,
        requestPayload: sanitizeRequest(dto, sourceFile),
        reservedCredits: reserved,
        chargedCredits: 0,
        inputTokens: 0,
        outputTokens: 0,
        errorMessage: null,
        completedAt: null,
      }),
    );
    let reservationCreated = false;
    try {
      await this.credits.reserve(
        teacherId,
        'quiz_generation',
        job.id,
        reserved,
      );
      reservationCreated = true;
      if (sourceFile) {
        job.sourceStorageKey = await this.sourceStorage.store(
          job.id,
          sourceFile,
        );
        job = await this.jobs.save(job);
      }
      await this.queue.enqueue(job.id);
      return {
        job: this.toResponse(job, provider.name),
        credit: await this.credits.get(teacherId),
      };
    } catch (error) {
      if (reservationCreated)
        await this.credits
          .release(teacherId, 'quiz_generation', job.id, reserved)
          .catch(() => undefined);
      await this.sourceStorage
        .delete(job.sourceStorageKey)
        .catch(() => undefined);
      job.status = AiGenerationJobStatus.FAILED;
      job.stage = AiGenerationJobStage.FAILED;
      job.errorMessage = safeError(error);
      job.completedAt = new Date();
      await this.jobs.save(job);
      throw error;
    }
  }

  async process(jobId: string): Promise<void> {
    let job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.status === AiGenerationJobStatus.SUCCEEDED) return;
    const dto = dtoFromPayload(job.requestPayload);
    const sourceType = dto.sourceType ?? 'prompt';
    const provider = await this.providers.resolve(job.providerId);
    job.status = AiGenerationJobStatus.RUNNING;
    job.stage =
      sourceType === 'upload'
        ? AiGenerationJobStage.READING_DOCUMENT
        : AiGenerationJobStage.GENERATING_QUIZ;
    job.attemptCount += 1;
    job.errorMessage = null;
    job.completedAt = null;
    await this.jobs.save(job);

    if (job.quizId) {
      await this.quizzes
        .remove(job.quizId, job.teacherId)
        .catch(() => undefined);
      job.quizId = null;
      await this.jobs.update(job.id, { quizId: null });
    }

    let quizId: string | null = null;
    try {
      let questions: GeneratedQuestion[];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      if (sourceType === 'upload') {
        const source = await this.extractStoredSource(job);
        const chunkRows = await this.prepareChunks(
          job,
          source.pages,
          dto.questionCount,
        );
        const distribution = buildCognitiveDistribution(dto.questionCount);
        const analyzed = await this.analyzeDocumentChunks(
          job,
          dto,
          provider,
          chunkRows,
        );
        const planned = await this.prepareQuizBlueprint(
          job,
          dto,
          provider,
          analyzed.analyses,
          distribution,
        );
        const generated = await this.generateChunkCandidates(
          job,
          dto,
          provider,
          chunkRows,
          analyzed.analyses,
          planned.blueprint,
          distribution,
        );
        const reviewed = await this.reviewQuestions(
          job,
          dto,
          provider,
          planned.blueprint,
          generated.questions,
          distribution,
          source.pages,
        );
        questions = reviewed.questions.map((question) =>
          qualityQuestionForQuiz(question, dto),
        );
        totalInputTokens =
          source.visionInputTokens +
          analyzed.inputTokens +
          planned.inputTokens +
          generated.inputTokens +
          reviewed.inputTokens;
        totalOutputTokens =
          source.visionOutputTokens +
          analyzed.outputTokens +
          planned.outputTokens +
          generated.outputTokens +
          reviewed.outputTokens;
      } else {
        const completion = await this.client.completeJson(
          provider,
          generationSystemPrompt(),
          generationUserPrompt(dto, null),
          {
            source: 'quiz_generation',
            referenceId: job.id,
            userId: job.teacherId,
          },
          generationOutputSchema(dto.questionTypes, dto.questionCount),
        );
        questions = validateGeneratedQuestions(
          completion.value,
          dto.questionCount,
          dto.questionTypes,
        );
        totalInputTokens = completion.inputTokens;
        totalOutputTokens = completion.outputTokens;
      }

      await this.updateProgress(job, {
        stage: AiGenerationJobStage.SAVING_QUIZ,
      });
      let quiz = await this.quizzes.create(job.teacherId, {
        title: dto.title,
        description: dto.description,
      });
      quizId = quiz.id;
      job.quizId = quizId;
      await this.jobs.update(job.id, { quizId });
      for (const question of questions) {
        quiz = await this.quizzes.addQuestion(quiz.id, job.teacherId, {
          type: question.type as QuizQuestionType,
          content: question.content,
          explanation: question.explanation ?? null,
          showExplanation: true,
          options: question.options,
        });
      }
      const charged = calculateCharge(
        provider.baseCreditCost,
        provider.creditCostPer1kTokens,
        totalInputTokens + totalOutputTokens,
        job.reservedCredits,
      );
      await this.credits.settle(
        job.teacherId,
        'quiz_generation',
        job.id,
        job.reservedCredits,
        charged,
      );
      job = await this.jobs.save({
        ...job,
        quizId,
        status: AiGenerationJobStatus.SUCCEEDED,
        stage: AiGenerationJobStage.COMPLETED,
        chargedCredits: charged,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        completedAt: new Date(),
        errorMessage: null,
      });
      const completedJobId = job.id;
      await this.cleanupArtifacts(job).catch((error: unknown) =>
        this.logger.warn(
          `Không thể dọn dữ liệu tạm của AI job ${completedJobId}: ${safeError(error)}`,
        ),
      );
    } catch (error) {
      if (quizId) {
        await this.quizzes.remove(quizId, job.teacherId).catch(() => undefined);
        job.quizId = null;
        await this.jobs.update(job.id, { quizId: null });
      }
      throw error;
    }
  }

  async markRetrying(jobId: string, error: unknown): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.status === AiGenerationJobStatus.SUCCEEDED) return;
    job.status = AiGenerationJobStatus.PENDING;
    job.stage = AiGenerationJobStage.QUEUED;
    job.errorMessage = `Lần xử lý ${job.attemptCount} chưa thành công, hệ thống đang tự thử lại: ${safeError(error)}`;
    await this.jobs.save(job);
  }

  async markFailed(jobId: string, error: unknown): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.status === AiGenerationJobStatus.SUCCEEDED) return;
    await this.credits
      .release(job.teacherId, 'quiz_generation', job.id, job.reservedCredits)
      .catch((releaseError: unknown) =>
        this.logger.error(
          `Không thể hoàn credit cho AI job ${job.id}: ${safeError(releaseError)}`,
        ),
      );
    job.status = AiGenerationJobStatus.FAILED;
    job.stage = AiGenerationJobStage.FAILED;
    job.errorMessage = safeError(error);
    job.completedAt = new Date();
    await this.jobs.save(job);
    await this.cleanupArtifacts(job).catch(() => undefined);
  }

  async get(jobId: string, teacherId: string): Promise<AiGenerationJob> {
    const job = await this.jobs.findOne({ where: { id: jobId, teacherId } });
    if (!job) throw new NotFoundException('Tác vụ sinh quiz không tồn tại');
    const provider = await this.providers
      .resolve(job.providerId)
      .catch(() => null);
    return this.toResponse(job, provider?.name ?? 'Provider đã tắt');
  }

  private async extractStoredSource(job: AiGenerationJobEntity) {
    if (
      !job.sourceStorageKey ||
      !job.sourceOriginalName ||
      !job.sourceMimeType ||
      job.sourceSize === null
    )
      throw new BadRequestException('Tài liệu nguồn của tác vụ không tồn tại');
    const [buffer, savedPages, visionProvider] = await Promise.all([
      this.sourceStorage.read(job.sourceStorageKey),
      this.documentPages.find({
        where: { jobId: job.id },
        order: { pageNumber: 'ASC' },
      }),
      job.visionProviderId
        ? this.providers.resolve(job.visionProviderId)
        : this.providers.resolveVision(),
    ]);
    const file = multerFileFromJob(job, buffer);
    return this.materialSource.extract(file, {
      provider: visionProvider,
      referenceId: job.id,
      userId: job.teacherId,
      existingPages: savedPages.map(pageEntityToMaterialPage),
      onPageExtracted: async (page) => {
        await this.documentPages.save(
          this.documentPages.create({
            jobId: job.id,
            pageNumber: page.pageNumber,
            text: page.text,
            extractionMethod: page.method as AiDocumentPageExtractionMethod,
            confidence: page.confidence,
            visionInputTokens: page.visionInputTokens,
            visionOutputTokens: page.visionOutputTokens,
          }),
        );
      },
      onProgress: async ({ totalPages, processedPages }) => {
        await this.updateProgress(job, {
          stage: AiGenerationJobStage.READING_DOCUMENT,
          documentTotalPages: totalPages,
          documentProcessedPages: processedPages,
        });
      },
    });
  }

  private async prepareChunks(
    job: AiGenerationJobEntity,
    pages: AiMaterialPage[],
    questionCount: number,
  ): Promise<AiGenerationChunkEntity[]> {
    let rows = await this.chunks.find({
      where: { jobId: job.id },
      order: { chunkIndex: 'ASC' },
    });
    if (!rows.length) {
      const prepared = buildDocumentChunks(pages, questionCount);
      rows = await this.chunks.save(
        prepared.map((chunk) =>
          this.chunks.create({
            ...chunk,
            jobId: job.id,
            analysis: null,
            analysisInputTokens: 0,
            analysisOutputTokens: 0,
            status: AiGenerationChunkStatus.PENDING,
            candidateQuestions: null,
            inputTokens: 0,
            outputTokens: 0,
            attempts: 0,
            lastError: null,
          }),
        ),
      );
    }
    const completed = rows.filter(
      (row) => row.status === AiGenerationChunkStatus.COMPLETED,
    ).length;
    await this.updateProgress(job, {
      generationTotalChunks: rows.length,
      generationProcessedChunks: completed,
    });
    return rows;
  }

  private async analyzeDocumentChunks(
    job: AiGenerationJobEntity,
    dto: GenerateQuizWithAiDto,
    provider: Awaited<ReturnType<AiProviderService['resolve']>>,
    rows: AiGenerationChunkEntity[],
  ): Promise<{
    analyses: QuizChunkAnalysis[];
    inputTokens: number;
    outputTokens: number;
  }> {
    const analyses: QuizChunkAnalysis[] = [];
    let completed = rows.filter((row) => row.analysis !== null).length;
    await this.updateProgress(job, {
      stage: AiGenerationJobStage.ANALYZING_DOCUMENT,
      generationTotalChunks: rows.length,
      generationProcessedChunks: completed,
    });
    for (const row of rows) {
      const saved = validateChunkAnalysis(row.analysis, row);
      if (saved) {
        analyses.push(saved);
        continue;
      }
      const completion = await this.client.completeJson(
        provider,
        chunkAnalysisSystemPrompt(),
        chunkAnalysisUserPrompt(dto, chunkFromRow(row)),
        {
          source: 'quiz_generation',
          referenceId: job.id,
          userId: job.teacherId,
        },
        chunkAnalysisOutputSchema(),
      );
      const analysis = requireChunkAnalysis(completion.value, row);
      row.analysis = analysis;
      row.analysisInputTokens = completion.inputTokens;
      row.analysisOutputTokens = completion.outputTokens;
      row.lastError = null;
      await this.chunks.save(row);
      analyses.push(analysis);
      completed += 1;
      await this.updateProgress(job, {
        stage: AiGenerationJobStage.ANALYZING_DOCUMENT,
        generationTotalChunks: rows.length,
        generationProcessedChunks: completed,
      });
    }
    return {
      analyses,
      inputTokens: rows.reduce(
        (total, row) => total + (row.analysisInputTokens ?? 0),
        0,
      ),
      outputTokens: rows.reduce(
        (total, row) => total + (row.analysisOutputTokens ?? 0),
        0,
      ),
    };
  }

  private async prepareQuizBlueprint(
    job: AiGenerationJobEntity,
    dto: GenerateQuizWithAiDto,
    provider: Awaited<ReturnType<AiProviderService['resolve']>>,
    analyses: QuizChunkAnalysis[],
    distribution: CognitiveDistribution,
  ): Promise<{
    blueprint: QuizBlueprint;
    inputTokens: number;
    outputTokens: number;
  }> {
    const stored = readStoredBlueprint(job.quizBlueprint, analyses, dto.topic);
    if (stored) return stored;
    await this.updateProgress(job, {
      stage: AiGenerationJobStage.PLANNING_QUIZ,
      generationTotalChunks: analyses.length,
      generationProcessedChunks: analyses.length,
    });
    const completion = await this.client.completeJson(
      provider,
      quizBlueprintSystemPrompt(),
      quizBlueprintUserPrompt(dto, analyses, distribution),
      {
        source: 'quiz_generation',
        referenceId: job.id,
        userId: job.teacherId,
      },
      quizBlueprintOutputSchema(),
    );
    const blueprint = requireQuizBlueprint(
      completion.value,
      analyses,
      dto.topic,
    );
    job.quizBlueprint = {
      blueprint: blueprint as unknown as Record<string, unknown>,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
    };
    await this.jobs.save(job);
    return {
      blueprint,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
    };
  }

  private async generateChunkCandidates(
    job: AiGenerationJobEntity,
    dto: GenerateQuizWithAiDto,
    provider: Awaited<ReturnType<AiProviderService['resolve']>>,
    rows: AiGenerationChunkEntity[],
    analyses: QuizChunkAnalysis[],
    blueprint: QuizBlueprint,
    distribution: CognitiveDistribution,
  ): Promise<{
    questions: QualityQuestion[];
    inputTokens: number;
    outputTokens: number;
  }> {
    const analysisByChunk = new Map(
      analyses.map((analysis) => [analysis.chunkIndex, analysis]),
    );
    const selectedRows = selectQualityChunks(
      rows,
      analyses,
      blueprint,
      dto.questionCount,
    );
    const questions: QualityQuestion[] = [];
    let completed = selectedRows.filter(
      (row) => row.status === AiGenerationChunkStatus.COMPLETED,
    ).length;
    for (const row of selectedRows) {
      const analysis = analysisByChunk.get(row.chunkIndex);
      if (!analysis)
        throw new BadGatewayException(
          `Thiếu phân tích cho phần ${row.chunkIndex + 1}`,
        );
      if (
        row.status === AiGenerationChunkStatus.COMPLETED &&
        Array.isArray(row.candidateQuestions)
      ) {
        const saved = validateQualityQuestions(
          { questions: row.candidateQuestions },
          row.candidateQuestions.length,
          dto.questionTypes,
          blueprint,
          undefined,
          row.text,
        );
        if (saved) {
          questions.push(...saved);
          continue;
        }
      }
      const candidateCount = qualityCandidateCount(
        dto.questionCount,
        selectedRows.length,
      );
      row.status = AiGenerationChunkStatus.PROCESSING;
      row.attempts += 1;
      row.lastError = null;
      await this.chunks.save(row);
      await this.updateProgress(job, {
        stage: AiGenerationJobStage.GENERATING_CANDIDATES,
        generationTotalChunks: selectedRows.length,
        generationProcessedChunks: completed,
      });
      try {
        const completion = await this.client.completeJson(
          provider,
          qualityCandidateSystemPrompt(),
          qualityCandidateUserPrompt(
            dto,
            chunkFromRow(row),
            analysis,
            blueprint,
            candidateCount,
            distribution,
          ),
          {
            source: 'quiz_generation',
            referenceId: job.id,
            userId: job.teacherId,
          },
          qualityQuestionsOutputSchema(dto.questionTypes, candidateCount),
        );
        const candidates = requireQualityQuestions(
          completion.value,
          candidateCount,
          dto.questionTypes,
          blueprint,
          undefined,
          row.text,
        );
        row.status = AiGenerationChunkStatus.COMPLETED;
        row.candidateQuestions = candidates;
        row.inputTokens = completion.inputTokens;
        row.outputTokens = completion.outputTokens;
        row.lastError = null;
        await this.chunks.save(row);
        questions.push(...candidates);
        completed += 1;
        await this.updateProgress(job, {
          stage: AiGenerationJobStage.GENERATING_CANDIDATES,
          generationTotalChunks: selectedRows.length,
          generationProcessedChunks: completed,
        });
      } catch (error) {
        row.status = AiGenerationChunkStatus.FAILED;
        row.lastError = safeError(error);
        await this.chunks.save(row);
        throw error;
      }
    }
    return {
      questions,
      inputTokens: selectedRows.reduce(
        (total, row) => total + row.inputTokens,
        0,
      ),
      outputTokens: selectedRows.reduce(
        (total, row) => total + row.outputTokens,
        0,
      ),
    };
  }

  private async reviewQuestions(
    job: AiGenerationJobEntity,
    dto: GenerateQuizWithAiDto,
    provider: Awaited<ReturnType<AiProviderService['resolve']>>,
    blueprint: QuizBlueprint,
    candidates: QualityQuestion[],
    distribution: CognitiveDistribution,
    pages: AiMaterialPage[],
  ): Promise<{
    questions: QualityQuestion[];
    inputTokens: number;
    outputTokens: number;
  }> {
    if (candidates.length < dto.questionCount)
      throw new BadGatewayException(
        `AI chỉ tạo được ${candidates.length}/${dto.questionCount} câu hỏi ứng viên`,
      );
    await this.updateProgress(job, {
      stage: AiGenerationJobStage.REVIEWING_QUESTIONS,
      generationTotalChunks: job.generationTotalChunks,
      generationProcessedChunks: job.generationTotalChunks ?? 0,
    });
    const completion = await this.client.completeJson(
      provider,
      qualityReviewSystemPrompt(),
      qualityReviewUserPrompt(dto, blueprint, candidates, distribution),
      {
        source: 'quiz_generation',
        referenceId: job.id,
        userId: job.teacherId,
      },
      qualityQuestionsOutputSchema(dto.questionTypes, dto.questionCount),
    );
    return {
      questions: requireQualityQuestions(
        completion.value,
        dto.questionCount,
        dto.questionTypes,
        blueprint,
        distribution,
        pages.map((page) => page.text).join('\n'),
      ),
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
    };
  }

  private toResponse(
    job: AiGenerationJobEntity,
    providerName: string,
  ): AiGenerationJob {
    return {
      id: job.id,
      status: job.status,
      stage: job.stage ?? stageFromStatus(job.status),
      documentTotalPages: job.documentTotalPages ?? null,
      documentProcessedPages: job.documentProcessedPages ?? 0,
      generationTotalChunks: job.generationTotalChunks ?? null,
      generationProcessedChunks: job.generationProcessedChunks ?? 0,
      attemptCount: job.attemptCount ?? 0,
      providerId: job.providerId,
      providerName,
      quizId: job.quizId,
      reservedCredits: job.reservedCredits,
      chargedCredits: job.chargedCredits,
      inputTokens: job.inputTokens,
      outputTokens: job.outputTokens,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  private async updateProgress(
    job: AiGenerationJobEntity,
    updates: Partial<
      Pick<
        AiGenerationJobEntity,
        | 'stage'
        | 'documentTotalPages'
        | 'documentProcessedPages'
        | 'generationTotalChunks'
        | 'generationProcessedChunks'
      >
    >,
  ): Promise<void> {
    Object.assign(job, updates);
    await this.jobs.update(job.id, updates);
  }

  private async cleanupArtifacts(job: AiGenerationJobEntity): Promise<void> {
    await Promise.all([
      this.sourceStorage.delete(job.sourceStorageKey),
      this.documentPages.delete({ jobId: job.id }),
      this.chunks.delete({ jobId: job.id }),
    ]);
  }
}

export function estimateReservedCredits(
  base: number,
  per1k: number,
  questionCount: number,
): number {
  return Math.max(
    1,
    base + Math.ceil((2000 + questionCount * 500) / 1000) * per1k,
  );
}

export function calculateCharge(
  base: number,
  per1k: number,
  tokens: number,
  reserved: number,
): number {
  return Math.min(
    reserved,
    Math.max(1, base + Math.ceil(Math.max(0, tokens) / 1000) * per1k),
  );
}

function sanitizeRequest(
  dto: GenerateQuizWithAiDto,
  sourceFile?: Express.Multer.File,
): Record<string, unknown> {
  const request: Record<string, unknown> = { ...dto };
  delete request.jobId;
  return {
    ...request,
    sourceFile: sourceFile
      ? {
          name: sourceFile.originalname.slice(0, 255),
          mimeType: sourceFile.mimetype,
          size: sourceFile.size,
        }
      : null,
  };
}

function dtoFromPayload(
  payload: Record<string, unknown>,
): GenerateQuizWithAiDto {
  return Object.assign(new GenerateQuizWithAiDto(), {
    title: stringValue(payload.title),
    description:
      typeof payload.description === 'string' ? payload.description : undefined,
    topic: stringValue(payload.topic),
    language: payload.language,
    difficulty: payload.difficulty,
    questionCount: Number(payload.questionCount),
    questionTypes: Array.isArray(payload.questionTypes)
      ? payload.questionTypes
      : undefined,
    sourceType: payload.sourceType,
  });
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function multerFileFromJob(
  job: AiGenerationJobEntity,
  buffer: Buffer,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: job.sourceOriginalName!,
    encoding: '7bit',
    mimetype: job.sourceMimeType!,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
  };
}

function pageEntityToMaterialPage(
  page: AiGenerationDocumentPageEntity,
): AiMaterialPage {
  return {
    pageNumber: page.pageNumber,
    text: page.text,
    method: page.extractionMethod,
    confidence: page.confidence,
    visionInputTokens: page.visionInputTokens,
    visionOutputTokens: page.visionOutputTokens,
  };
}

export function buildDocumentChunks(
  pages: AiMaterialPage[],
  questionCount: number,
): DocumentChunk[] {
  const available = pages
    .map((page) => ({ ...page, text: page.text.trim() }))
    .filter((page) => page.text.length > 0);
  const totalCharacters = Math.min(
    MAX_CHUNK_SOURCE_CHARACTERS,
    available.reduce((total, page) => total + page.text.length, 0),
  );
  if (totalCharacters < 1)
    throw new BadRequestException('Tài liệu không có chữ');
  const desiredChunks = Math.min(
    MAX_GENERATION_CHUNKS,
    Math.max(
      1,
      Math.ceil(totalCharacters / TARGET_CHUNK_CHARACTERS),
      Math.ceil(questionCount / 6),
    ),
  );
  const targetCharacters = Math.max(
    1000,
    Math.ceil(totalCharacters / desiredChunks),
  );
  const chunks: DocumentChunk[] = [];
  let current = '';
  let startPage: number | null = null;
  let endPage: number | null = null;
  let consumed = 0;

  const flush = () => {
    const text = current.trim();
    if (!text) return;
    chunks.push({
      chunkIndex: chunks.length,
      startPage,
      endPage,
      text,
    });
    current = '';
    startPage = null;
    endPage = null;
  };

  for (const page of available) {
    let remaining = page.text;
    while (remaining && consumed < MAX_CHUNK_SOURCE_CHARACTERS) {
      const room = Math.min(
        targetCharacters - current.length,
        MAX_CHUNK_SOURCE_CHARACTERS - consumed,
      );
      if (room <= 0) {
        flush();
        continue;
      }
      const take = splitText(remaining, room);
      if (startPage === null) startPage = page.pageNumber;
      endPage = page.pageNumber;
      current += `${current ? '\n' : ''}[Trang ${page.pageNumber}] ${take}`;
      consumed += take.length;
      remaining = remaining.slice(take.length).trimStart();
      if (current.length >= targetCharacters) flush();
    }
    if (consumed >= MAX_CHUNK_SOURCE_CHARACTERS) break;
  }
  flush();
  return chunks;
}

function splitText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const candidate = text.slice(0, limit);
  const boundary = Math.max(
    candidate.lastIndexOf('. '),
    candidate.lastIndexOf(' '),
  );
  return candidate.slice(0, boundary >= limit * 0.6 ? boundary + 1 : limit);
}

function qualityCandidateCount(questionCount: number, chunks: number): number {
  if (chunks <= 1) return Math.max(2, questionCount + 2);
  return Math.max(2, Math.min(6, Math.ceil((questionCount * 1.6) / chunks)));
}

export function buildCognitiveDistribution(
  questionCount: number,
): CognitiveDistribution {
  const targets = [
    { key: 'remember' as const, value: questionCount * 0.2, order: 2 },
    { key: 'understand' as const, value: questionCount * 0.5, order: 0 },
    { key: 'apply' as const, value: questionCount * 0.3, order: 1 },
  ];
  const result: CognitiveDistribution = {
    remember: Math.floor(targets[0].value),
    understand: Math.floor(targets[1].value),
    apply: Math.floor(targets[2].value),
  };
  let remaining =
    questionCount - Object.values(result).reduce((a, b) => a + b, 0);
  for (const target of [...targets].sort((a, b) => {
    const fractionDifference =
      b.value - Math.floor(b.value) - (a.value - Math.floor(a.value));
    return fractionDifference || a.order - b.order;
  })) {
    if (remaining < 1) break;
    result[target.key] += 1;
    remaining -= 1;
  }
  return result;
}

function selectQualityChunks(
  rows: AiGenerationChunkEntity[],
  analyses: QuizChunkAnalysis[],
  blueprint: QuizBlueprint,
  questionCount: number,
): AiGenerationChunkEntity[] {
  const analysisByChunk = new Map(
    analyses.map((analysis) => [analysis.chunkIndex, analysis]),
  );
  const objectiveWeightByChunk = new Map<number, number>();
  for (const objective of blueprint.objectives) {
    for (const chunkIndex of objective.sourceChunkIndexes) {
      objectiveWeightByChunk.set(
        chunkIndex,
        Math.max(objectiveWeightByChunk.get(chunkIndex) ?? 0, objective.weight),
      );
    }
  }
  const eligible = rows
    .filter((row) => {
      const analysis = analysisByChunk.get(row.chunkIndex);
      return (
        analysis &&
        analysis.relevanceScore >= 25 &&
        analysis.keyPoints.length > 0 &&
        objectiveWeightByChunk.has(row.chunkIndex)
      );
    })
    .sort((a, b) => {
      const weight =
        (objectiveWeightByChunk.get(b.chunkIndex) ?? 0) -
        (objectiveWeightByChunk.get(a.chunkIndex) ?? 0);
      if (weight) return weight;
      return (
        (analysisByChunk.get(b.chunkIndex)?.relevanceScore ?? 0) -
        (analysisByChunk.get(a.chunkIndex)?.relevanceScore ?? 0)
      );
    });
  if (!eligible.length)
    throw new BadGatewayException(
      'AI không tìm thấy phần kiến thức trọng tâm phù hợp để sinh quiz',
    );
  const limit = Math.min(
    eligible.length,
    Math.max(1, Math.ceil(questionCount / 3) + 2),
  );
  const selected = new Map<number, AiGenerationChunkEntity>();
  for (const objective of [...blueprint.objectives].sort(
    (a, b) => b.weight - a.weight,
  )) {
    const row = eligible.find((candidate) =>
      objective.sourceChunkIndexes.includes(candidate.chunkIndex),
    );
    if (row) selected.set(row.chunkIndex, row);
    if (selected.size >= limit) break;
  }
  for (const row of eligible) {
    if (selected.size >= limit) break;
    selected.set(row.chunkIndex, row);
  }
  return [...selected.values()].sort((a, b) => a.chunkIndex - b.chunkIndex);
}

export function selectQuestions(
  grouped: GeneratedQuestion[][],
  expected: number,
): GeneratedQuestion[] {
  const selected: GeneratedQuestion[] = [];
  const seen = new Set<string>();
  const maxCandidates = Math.max(0, ...grouped.map((group) => group.length));
  for (let offset = 0; offset < maxCandidates; offset += 1) {
    for (const group of grouped) {
      const question = group[offset];
      if (!question) continue;
      const key = question.content
        .normalize('NFKC')
        .toLocaleLowerCase('vi')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      selected.push(question);
      if (selected.length === expected) return selected;
    }
  }
  throw new BadGatewayException(
    `AI chỉ tạo được ${selected.length}/${expected} câu hỏi không trùng lặp`,
  );
}

function stageFromStatus(status: AiGenerationJobStatus): AiGenerationJobStage {
  if (status === AiGenerationJobStatus.SUCCEEDED)
    return AiGenerationJobStage.COMPLETED;
  if (status === AiGenerationJobStatus.FAILED)
    return AiGenerationJobStage.FAILED;
  if (status === AiGenerationJobStatus.RUNNING)
    return AiGenerationJobStage.GENERATING_QUIZ;
  return AiGenerationJobStage.QUEUED;
}

export function validateGeneratedQuestions(
  value: unknown,
  expected: number,
  allowed?: SharedQuestionType[],
): GeneratedQuestion[] {
  const questions = (value as { questions?: unknown })?.questions;
  if (!Array.isArray(questions) || questions.length !== expected)
    throw new BadGatewayException(
      `Provider AI phải trả đúng ${expected} câu hỏi`,
    );
  const allowedTypes = new Set(
    allowed?.length
      ? allowed
      : ['single_choice', 'true_false', 'multiple_choice'],
  );
  return questions.map((raw, index) => {
    const row = raw as Partial<GeneratedQuestion>;
    const options = row.options;
    if (
      !row ||
      typeof row.content !== 'string' ||
      row.content.trim().length < 2 ||
      !allowedTypes.has(row.type as SharedQuestionType)
    )
      throw new BadGatewayException(
        `Câu ${index + 1} có nội dung hoặc loại không hợp lệ`,
      );
    if (
      !Array.isArray(options) ||
      options.length < 2 ||
      options.some(
        (option) =>
          typeof option?.content !== 'string' ||
          typeof option?.isCorrect !== 'boolean' ||
          DISALLOWED_OPTION.test(option.content),
      )
    )
      throw new BadGatewayException(
        `Câu ${index + 1} phải có ít nhất 2 lựa chọn hợp lệ`,
      );
    const correct = options.filter((option) => option.isCorrect).length;
    const optionKeys = options.map((option) => normalized(option.content));
    if (new Set(optionKeys).size !== optionKeys.length)
      throw new BadGatewayException(`Câu ${index + 1} có lựa chọn bị trùng`);
    if (
      (row.type === 'single_choice' &&
        (options.length !== 4 || correct !== 1)) ||
      (row.type === 'true_false' && (options.length !== 2 || correct !== 1)) ||
      (row.type === 'multiple_choice' &&
        (options.length < 4 ||
          options.length > 6 ||
          correct < 2 ||
          correct >= options.length))
    )
      throw new BadGatewayException(
        `Câu ${index + 1} có số lựa chọn hoặc đáp án đúng không hợp lệ`,
      );
    return {
      type: row.type!,
      content: row.content.trim().slice(0, 5000),
      explanation: row.explanation?.trim().slice(0, 5000),
      options: options.map((option) => ({
        content: option.content.trim().slice(0, 1000),
        isCorrect: option.isCorrect,
      })),
    };
  });
}

function chunkFromRow(row: AiGenerationChunkEntity): DocumentChunk {
  return {
    chunkIndex: row.chunkIndex,
    startPage: row.startPage,
    endPage: row.endPage,
    text: row.text,
  };
}

function requireChunkAnalysis(
  value: unknown,
  row: AiGenerationChunkEntity,
): QuizChunkAnalysis {
  const parsed = validateChunkAnalysis(value, row);
  if (!parsed)
    throw new BadGatewayException(
      `AI phân tích phần ${row.chunkIndex + 1} không hợp lệ`,
    );
  return parsed;
}

function validateChunkAnalysis(
  value: unknown,
  row: AiGenerationChunkEntity,
): QuizChunkAnalysis | null {
  try {
    const record = objectValue(value);
    const chunkIndex = integerValue(
      record.chunkIndex,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    if (chunkIndex !== row.chunkIndex) throw new Error('Sai chunkIndex');
    const sectionType = enumValue(record.sectionType, [
      'core_content',
      'exercise',
      'front_matter',
      'table_of_contents',
      'copyright',
      'answer_key',
      'appendix',
      'other',
    ] as const);
    const relevanceScore = integerValue(record.relevanceScore, 0, 100);
    const summary = requiredText(record.summary, 1, 2000);
    const excludedReason = textValue(record.excludedReason).slice(0, 1000);
    if (!Array.isArray(record.keyPoints) || record.keyPoints.length > 8)
      throw new Error('keyPoints không hợp lệ');
    const keyPoints = record.keyPoints.map((raw) => {
      const point = objectValue(raw);
      const evidence = requiredText(point.evidence, 2, 800);
      const sourcePages = integerArray(point.sourcePages, 1);
      if (
        sourcePages.some(
          (page) =>
            (row.startPage !== null && page < row.startPage) ||
            (row.endPage !== null && page > row.endPage),
        )
      )
        throw new Error('Trang evidence nằm ngoài chunk');
      return {
        title: requiredText(point.title, 2, 300),
        description: requiredText(point.description, 2, 1200),
        importance: integerValue(point.importance, 1, 5),
        cognitiveLevels: enumArray(point.cognitiveLevels, [
          'remember',
          'understand',
          'apply',
        ] as const),
        evidence,
        sourcePages,
      };
    });
    const excludedSection = [
      'front_matter',
      'table_of_contents',
      'copyright',
      'answer_key',
    ].includes(sectionType);
    return {
      chunkIndex,
      sectionType,
      relevanceScore: excludedSection ? Math.min(10, relevanceScore) : relevanceScore,
      summary,
      keyPoints: excludedSection ? [] : keyPoints,
      excludedReason:
        excludedSection && !excludedReason
          ? 'Nội dung phụ không dùng để đánh giá kiến thức trọng tâm'
          : excludedReason,
    };
  } catch {
    return null;
  }
}

function readStoredBlueprint(
  value: unknown,
  analyses: QuizChunkAnalysis[],
  topic: string,
): {
  blueprint: QuizBlueprint;
  inputTokens: number;
  outputTokens: number;
} | null {
  try {
    const stored = objectValue(value);
    const blueprint = requireQuizBlueprint(stored.blueprint, analyses, topic);
    return {
      blueprint,
      inputTokens: integerValue(stored.inputTokens, 0, Number.MAX_SAFE_INTEGER),
      outputTokens: integerValue(
        stored.outputTokens,
        0,
        Number.MAX_SAFE_INTEGER,
      ),
    };
  } catch {
    return null;
  }
}

function requireQuizBlueprint(
  value: unknown,
  analyses: QuizChunkAnalysis[],
  topic: string,
): QuizBlueprint {
  try {
    const record = objectValue(value);
    const documentKind = enumValue(record.documentKind, [
      'english_reading',
      'english_grammar',
      'english_mixed',
      'general_subject',
    ] as const);
    if (!Array.isArray(record.objectives) || !record.objectives.length)
      throw new Error('Thiếu objectives');
    const validChunkIndexes = new Set(
      analyses
        .filter(
          (analysis) =>
            analysis.relevanceScore >= 25 && analysis.keyPoints.length > 0,
        )
        .map((analysis) => analysis.chunkIndex),
    );
    const allowMetadata = metadataRequested(topic);
    const ids = new Set<string>();
    const objectives = record.objectives
      .slice(0, 8)
      .map((raw) => {
        const objective = objectValue(raw);
        const id = requiredText(objective.id, 1, 40);
        if (ids.has(id)) throw new Error('Objective ID bị trùng');
        ids.add(id);
        const title = requiredText(objective.title, 2, 300);
        const description = requiredText(objective.description, 2, 1200);
        if (
          !allowMetadata &&
          isLowValueMetadataQuestion(`${title} ${description}`)
        )
          return null;
        const sourceChunkIndexes = integerArray(
          objective.sourceChunkIndexes,
          0,
        ).filter((chunkIndex) => validChunkIndexes.has(chunkIndex));
        if (!sourceChunkIndexes.length) return null;
        return {
          id,
          title,
          description,
          weight: integerValue(objective.weight, 1, 100),
          sourceChunkIndexes,
          sourcePages: integerArray(objective.sourcePages, 1),
          preferredCategories: enumArray(objective.preferredCategories, [
            'reading_comprehension',
            'vocabulary_in_context',
            'grammar',
            'core_concept',
            'application',
          ] as const),
        };
      })
      .filter((objective): objective is QuizBlueprint['objectives'][number] =>
        Boolean(objective),
      );
    if (!objectives.length)
      throw new Error('Blueprint không có mục tiêu trọng tâm');
    normalizeWeights(objectives);
    return {
      documentKind,
      language: requiredText(record.language, 1, 100),
      overview: requiredText(record.overview, 2, 3000),
      targetAudience: requiredText(record.targetAudience, 1, 300),
      objectives,
      excludedContent: stringArray(record.excludedContent, 20, 500),
      readingEvidenceRequired:
        documentKind === 'english_reading' || documentKind === 'english_mixed'
          ? true
          : Boolean(record.readingEvidenceRequired),
      grammarRuleExplanationRequired:
        documentKind === 'english_grammar' || documentKind === 'english_mixed'
          ? true
          : Boolean(record.grammarRuleExplanationRequired),
    };
  } catch (error) {
    throw new BadGatewayException(
      `AI lập kế hoạch quiz không hợp lệ: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function requireQualityQuestions(
  value: unknown,
  expected: number,
  allowed: SharedQuestionType[] | undefined,
  blueprint: QuizBlueprint,
  distribution?: CognitiveDistribution,
  sourceText?: string,
): QualityQuestion[] {
  const questions = validateQualityQuestions(
    value,
    expected,
    allowed,
    blueprint,
    distribution,
    sourceText,
  );
  if (!questions)
    throw new BadGatewayException(
      'Bộ câu hỏi AI không đạt rubric về trọng tâm, bằng chứng hoặc đáp án',
    );
  return questions;
}

function validateQualityQuestions(
  value: unknown,
  expected: number,
  allowed: SharedQuestionType[] | undefined,
  blueprint: QuizBlueprint,
  distribution?: CognitiveDistribution,
  sourceText?: string,
): QualityQuestion[] | null {
  try {
    const questions = objectValue(value).questions;
    if (!Array.isArray(questions) || questions.length !== expected)
      throw new Error('Sai số lượng câu hỏi');
    const allowedTypes = new Set(
      allowed?.length
        ? allowed
        : ['single_choice', 'true_false', 'multiple_choice'],
    );
    const objectiveById = new Map(
      blueprint.objectives.map((objective) => [objective.id, objective]),
    );
    const seen = new Set<string>();
    const parsed = questions.map((raw) => {
      const question = objectValue(raw);
      const type = enumValue(question.type, [
        'single_choice',
        'true_false',
        'multiple_choice',
      ] as const);
      if (!allowedTypes.has(type)) throw new Error('Loại câu không được phép');
      const content = requiredText(question.content, 2, 5000);
      const key = normalized(content);
      if (!key || seen.has(key)) throw new Error('Câu hỏi bị trùng');
      seen.add(key);
      const objectiveId = requiredText(question.objectiveId, 1, 40);
      const objective = objectiveById.get(objectiveId);
      if (!objective) throw new Error('Objective không tồn tại');
      if (
        isLowValueMetadataQuestion(content) &&
        !isLowValueMetadataQuestion(
          `${objective.title} ${objective.description}`,
        )
      )
        throw new Error('Câu hỏi dùng metadata không trọng tâm');
      const cognitiveLevel = enumValue(question.cognitiveLevel, [
        'remember',
        'understand',
        'apply',
      ] as const);
      const category = enumValue(question.category, [
        'reading_comprehension',
        'vocabulary_in_context',
        'grammar',
        'core_concept',
        'application',
      ] as const);
      const explanation = requiredText(
        question.explanation,
        category === 'grammar' ? 40 : 15,
        5000,
      );
      if (!Array.isArray(question.options)) throw new Error('Thiếu lựa chọn');
      const options = question.options.map((rawOption) => {
        const option = objectValue(rawOption);
        const optionContent = requiredText(option.content, 1, 1000);
        if (DISALLOWED_OPTION.test(optionContent))
          throw new Error('Lựa chọn all/none of the above');
        return {
          content: optionContent,
          isCorrect: booleanValue(option.isCorrect),
        };
      });
      const optionKeys = options.map((option) => normalized(option.content));
      if (new Set(optionKeys).size !== optionKeys.length)
        throw new Error('Lựa chọn bị trùng');
      const correct = options.filter((option) => option.isCorrect).length;
      if (type === 'single_choice' && (options.length !== 4 || correct !== 1))
        throw new Error('single_choice không đúng chuẩn 4/1');
      if (type === 'true_false' && (options.length !== 2 || correct !== 1))
        throw new Error('true_false không đúng chuẩn 2/1');
      if (
        type === 'multiple_choice' &&
        (options.length < 4 ||
          options.length > 6 ||
          correct < 2 ||
          correct >= options.length)
      )
        throw new Error('multiple_choice không có distractor hợp lệ');
      const sourcePages = integerArray(question.sourcePages, 1, true);
      if (sourcePages.some((page) => !objective.sourcePages.includes(page)))
        throw new Error('Trang nguồn không thuộc objective');
      const sourceEvidence = textValue(question.sourceEvidence).slice(0, 800);
      if (
        blueprint.readingEvidenceRequired &&
        ['reading_comprehension', 'vocabulary_in_context'].includes(category)
      ) {
        if (!sourcePages.length || sourceEvidence.length < 5)
          throw new Error('Câu reading thiếu nguồn');
        if (sourceText && !containsNormalized(sourceText, sourceEvidence))
          throw new Error('Nguồn reading không có trong tài liệu');
      }
      return {
        type,
        content,
        explanation,
        options,
        objectiveId,
        cognitiveLevel,
        category,
        sourcePages,
        sourceEvidence,
      };
    });
    if (distribution) {
      for (const level of ['remember', 'understand', 'apply'] as const) {
        if (
          parsed.filter((question) => question.cognitiveLevel === level)
            .length !== distribution[level]
        )
          throw new Error('Sai phân bố tư duy');
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function qualityQuestionForQuiz(
  question: QualityQuestion,
  dto: GenerateQuizWithAiDto,
): GeneratedQuestion {
  const showSource =
    ['reading_comprehension', 'vocabulary_in_context'].includes(
      question.category,
    ) && question.sourceEvidence.trim().length > 0;
  const pages = question.sourcePages.join(', ');
  const sourceLabel = dto.language === 'vi' ? 'Nguồn' : 'Source';
  const pageLabel = dto.language === 'vi' ? 'trang' : 'page';
  return {
    type: question.type,
    content: question.content,
    explanation: showSource
      ? `${question.explanation}\n\n${sourceLabel} (${pageLabel} ${pages}): “${question.sourceEvidence}”`
      : question.explanation,
    options: question.options,
  };
}

function normalizeWeights(objectives: QuizBlueprint['objectives']): void {
  const total = objectives.reduce(
    (sum, objective) => sum + objective.weight,
    0,
  );
  if (total < 1) throw new Error('Tổng trọng số bằng 0');
  const scaled = objectives.map((objective, index) => {
    const exact = (objective.weight / total) * 100;
    return { objective, index, exact, floor: Math.floor(exact) };
  });
  let remaining = 100 - scaled.reduce((sum, row) => sum + row.floor, 0);
  for (const row of [...scaled].sort(
    (a, b) => b.exact - b.floor - (a.exact - a.floor) || a.index - b.index,
  )) {
    if (remaining < 1) break;
    row.floor += 1;
    remaining -= 1;
  }
  scaled.forEach((row) => {
    row.objective.weight = row.floor;
  });
}

const LOW_VALUE_METADATA =
  /\b(author|illustrator|publisher|published|publishing|isbn|copyright|printed|publication|printing press)\b|tác giả|họa sĩ minh họa|nhà xuất bản|bản quyền|nơi in|năm xuất bản/i;
const DISALLOWED_OPTION =
  /\b(all|none) of the above\b|tất cả (các )?đáp án (ở )?trên|không (có )?đáp án nào (ở )?trên/i;

function metadataRequested(topic: string): boolean {
  return isLowValueMetadataQuestion(topic);
}

export function isLowValueMetadataQuestion(value: string): boolean {
  return LOW_VALUE_METADATA.test(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Dữ liệu không phải object');
  return value as Record<string, unknown>;
}

function requiredText(
  value: unknown,
  minimum: number,
  maximum: number,
): string {
  const text = textValue(value).trim();
  if (text.length < minimum) throw new Error('Chuỗi quá ngắn');
  return text.slice(0, maximum);
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function booleanValue(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Không phải boolean');
  return value;
}

function integerValue(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error('Số nguyên không hợp lệ');
  return parsed;
}

function integerArray(
  value: unknown,
  minimum: number,
  allowEmpty = false,
): number[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length < 1))
    throw new Error('Mảng số không hợp lệ');
  const parsed = value.map((item) =>
    integerValue(item, minimum, Number.MAX_SAFE_INTEGER),
  );
  return [...new Set(parsed)];
}

function stringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): string[] {
  if (!Array.isArray(value)) throw new Error('Mảng chuỗi không hợp lệ');
  return value
    .slice(0, maximumItems)
    .map((item) => requiredText(item, 1, maximumLength));
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value))
    throw new Error('Enum không hợp lệ');
  return value;
}

function enumArray<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number][] {
  if (!Array.isArray(value) || !value.length)
    throw new Error('Mảng enum không hợp lệ');
  return [...new Set(value.map((item) => enumValue(item, allowed)))];
}

function normalized(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('vi')
    .replace(/[“”‘’'"`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function containsNormalized(source: string, evidence: string): boolean {
  const needle = normalized(evidence);
  return needle.length >= 2 && normalized(source).includes(needle);
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(
    0,
    2000,
  );
}
