import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
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
import {
  AiModelClientService,
  type AiUsageContext,
} from './ai-model-client.service';
import {
  AiRequestError,
  isNonRetryableAiError,
  type AiGenerationErrorDetails,
} from './ai-error';
import type { AiProviderEntity } from './entities/ai-provider.entity';
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
import { boundedConcurrency, mapWithConcurrency } from './bounded-concurrency';

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

type GenerationResultCheckpoint = {
  questions: GeneratedQuestion[];
  inputTokens: number;
  outputTokens: number;
};

const MAX_GENERATION_CHUNKS = 40;
const TARGET_CHUNK_CHARACTERS = 24_000;
const MAX_CHUNK_SOURCE_CHARACTERS = 2_000_000;
const DEFAULT_ANALYSIS_CONCURRENCY = 2;
const MAX_ANALYSIS_CONCURRENCY = 6;
const DEFAULT_CANDIDATE_CONCURRENCY = 1;
const MAX_CANDIDATE_CONCURRENCY = 4;
const PAUSE_WATCH_INTERVAL_MS = 750;

class AiGenerationPausedError extends Error {
  constructor() {
    super('AI generation paused');
    this.name = 'AiGenerationPausedError';
  }
}

type PauseWatcher = {
  signal: AbortSignal;
  close: () => void;
};

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
    @Optional() private readonly config?: ConfigService,
  ) {}

  private analysisConcurrency(): number {
    return boundedConcurrency(
      this.config?.get<string | number>(
        'AI_GENERATION_CHUNK_ANALYSIS_CONCURRENCY',
      ),
      DEFAULT_ANALYSIS_CONCURRENCY,
      MAX_ANALYSIS_CONCURRENCY,
    );
  }

  private candidateConcurrency(): number {
    return boundedConcurrency(
      this.config?.get<string | number>(
        'AI_GENERATION_CHUNK_CANDIDATE_CONCURRENCY',
      ),
      DEFAULT_CANDIDATE_CONCURRENCY,
      MAX_CANDIDATE_CONCURRENCY,
    );
  }

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
    // Chỉ tài liệu upload mới đi qua bước phân tích chunk.
    const analysisProvider =
      sourceType === 'upload' ? await this.providers.resolveAnalysis() : null;
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
        analysisProviderId: analysisProvider?.id ?? null,
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
        sourceSha256: sourceFile
          ? createHash('sha256').update(sourceFile.buffer).digest('hex')
          : null,
        attemptCount: 0,
        quizBlueprint: null,
        generationResult: null,
        requestPayload: sanitizeRequest(dto, sourceFile),
        reservedCredits: reserved,
        chargedCredits: 0,
        inputTokens: 0,
        outputTokens: 0,
        errorMessage: null,
        extractionReport: null,
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

  async pause(jobId: string, teacherId: string): Promise<AiGenerationJob> {
    const job = await this.ownedJob(jobId, teacherId);
    if (
      job.status === AiGenerationJobStatus.PAUSED ||
      job.status === AiGenerationJobStatus.PAUSE_REQUESTED
    )
      return this.responseFor(job);
    if (
      job.status === AiGenerationJobStatus.SUCCEEDED ||
      job.status === AiGenerationJobStatus.FAILED ||
      job.status === AiGenerationJobStatus.CANCELLED
    )
      throw new ConflictException('Tác vụ này đã kết thúc nên không thể dừng');
    if (job.stage === AiGenerationJobStage.SAVING_QUIZ)
      throw new ConflictException(
        'Quiz đang được lưu; vui lòng chờ tác vụ hoàn tất trong giây lát',
      );

    // Job còn ở hàng đợi chưa thể có request AI đang bay, nên có thể dừng
    // ngay. Cách này cũng xử lý worker chưa kịp nhận job, không để UI mắc ở
    // "đang dừng" chỉ vì phải chờ một worker không làm gì.
    if (job.status === AiGenerationJobStatus.PENDING) {
      const paused = await this.jobs.update(
        {
          id: job.id,
          teacherId,
          status: AiGenerationJobStatus.PENDING,
        },
        {
          status: AiGenerationJobStatus.PAUSED,
          errorMessage: null,
          completedAt: null,
        },
      );
      if (paused.affected)
        return this.responseFor(await this.ownedJob(jobId, teacherId));
    }

    await this.jobs.update(
      {
        id: job.id,
        teacherId,
        status: AiGenerationJobStatus.RUNNING,
      },
      {
        status: AiGenerationJobStatus.PAUSE_REQUESTED,
        errorMessage: null,
      },
    );
    return this.responseFor(await this.ownedJob(jobId, teacherId));
  }

  async resume(jobId: string, teacherId: string): Promise<AiGenerationJob> {
    const job = await this.ownedJob(jobId, teacherId);
    if (job.status !== AiGenerationJobStatus.PAUSED)
      throw new ConflictException(
        job.status === AiGenerationJobStatus.PAUSE_REQUESTED
          ? 'Tác vụ vẫn đang lưu checkpoint; hãy chờ trạng thái đã dừng'
          : 'Chỉ có thể tiếp tục tác vụ đang dừng',
      );
    const resumed = await this.jobs.update(
      { id: job.id, teacherId, status: AiGenerationJobStatus.PAUSED },
      {
        status: AiGenerationJobStatus.PENDING,
        stage: AiGenerationJobStage.QUEUED,
        errorMessage: null,
        errorDetails: null,
        completedAt: null,
      },
    );
    if (resumed.affected === 0)
      throw new ConflictException('Tác vụ đã được tiếp tục ở một yêu cầu khác');
    try {
      await this.queue.enqueue(job.id);
    } catch (error) {
      await this.jobs.update(
        { id: job.id, status: AiGenerationJobStatus.PENDING },
        {
          status: AiGenerationJobStatus.PAUSED,
          errorMessage: `Chưa thể xếp hàng tiếp tục: ${safeError(error)}`,
        },
      );
      throw error;
    }
    return this.responseFor(await this.ownedJob(jobId, teacherId));
  }

  async cancel(jobId: string, teacherId: string): Promise<AiGenerationJob> {
    let job = await this.ownedJob(jobId, teacherId);
    if (job.status !== AiGenerationJobStatus.PAUSED) {
      if (job.status !== AiGenerationJobStatus.CANCELLED)
        throw new ConflictException(
          'Hãy dừng tác vụ hoàn toàn trước khi thay bằng tệp mới',
        );
    } else {
      const cancelled = await this.jobs.update(
        { id: job.id, teacherId, status: AiGenerationJobStatus.PAUSED },
        {
          status: AiGenerationJobStatus.CANCELLED,
          errorMessage: null,
          generationResult: null,
          completedAt: new Date(),
        },
      );
      if (cancelled.affected === 0)
        throw new ConflictException('Trạng thái tác vụ vừa thay đổi');
      job = await this.ownedJob(jobId, teacherId);
    }
    await this.credits.release(
      job.teacherId,
      'quiz_generation',
      job.id,
      job.reservedCredits,
    );
    await this.cleanupArtifacts(job);
    return this.responseFor(job);
  }

  async process(jobId: string): Promise<void> {
    let job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || isTerminalGenerationStatus(job.status)) return;
    if (job.status === AiGenerationJobStatus.PAUSE_REQUESTED) {
      await this.markPaused(job.id);
      return;
    }
    if (job.status === AiGenerationJobStatus.PAUSED) return;
    const dto = dtoFromPayload(job.requestPayload);
    const sourceType = dto.sourceType ?? 'prompt';
    const provider = await this.providers.resolve(job.providerId);
    const startStage =
      sourceType === 'upload'
        ? AiGenerationJobStage.READING_DOCUMENT
        : AiGenerationJobStage.GENERATING_QUIZ;
    const started = await this.jobs.update(
      { id: job.id, status: AiGenerationJobStatus.PENDING },
      {
        status: AiGenerationJobStatus.RUNNING,
        stage: startStage,
        attemptCount: job.attemptCount + 1,
        errorMessage: null,
        completedAt: null,
      },
    );
    if (started.affected === 0) return;
    Object.assign(job, {
      status: AiGenerationJobStatus.RUNNING,
      stage: startStage,
      attemptCount: job.attemptCount + 1,
      errorMessage: null,
      completedAt: null,
    });

    if (job.quizId) {
      await this.quizzes
        .remove(job.quizId, job.teacherId)
        .catch(() => undefined);
      job.quizId = null;
      await this.jobs.update(job.id, { quizId: null });
    }

    const pauseWatcher = this.watchPause(job.id);
    const processingJobId = job.id;
    let quizId: string | null = null;
    try {
      const savedResult = readGenerationResult(job.generationResult, dto);
      let questions = savedResult?.questions ?? [];
      let totalInputTokens = savedResult?.inputTokens ?? 0;
      let totalOutputTokens = savedResult?.outputTokens ?? 0;
      if (!savedResult && sourceType === 'upload') {
        await this.checkpointPause(job.id);
        const source = await this.extractStoredSource(job, pauseWatcher.signal);
        await this.checkpointPause(job.id);
        const chunkRows = await this.prepareChunks(
          job,
          source.pages,
          dto.questionCount,
        );
        const distribution = buildCognitiveDistribution(dto.questionCount);
        const analyzed = await this.analyzeDocumentChunks(
          job,
          dto,
          await this.resolveAnalysisProvider(job, provider),
          chunkRows,
          pauseWatcher.signal,
        );
        await this.checkpointPause(job.id);
        const planned = await this.prepareQuizBlueprint(
          job,
          dto,
          provider,
          analyzed.analyses,
          distribution,
          pauseWatcher.signal,
        );
        await this.checkpointPause(job.id);
        const generated = await this.generateChunkCandidates(
          job,
          dto,
          provider,
          chunkRows,
          analyzed.analyses,
          planned.blueprint,
          distribution,
          pauseWatcher.signal,
        );
        await this.checkpointPause(job.id);
        const reviewed = await this.reviewQuestions(
          job,
          dto,
          provider,
          planned.blueprint,
          generated.questions,
          distribution,
          source.pages,
          pauseWatcher.signal,
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
      } else if (!savedResult) {
        await this.checkpointPause(job.id);
        const completion = await this.completeCanonicalJson({
          provider,
          system: generationSystemPrompt(),
          prompt: generationUserPrompt(dto, null),
          usageContext: {
            source: 'quiz_generation',
            referenceId: job.id,
            userId: job.teacherId,
          },
          schema: generationOutputSchema(dto.questionTypes, dto.questionCount),
          parse: (value) =>
            validateGeneratedQuestions(
              value,
              dto.questionCount,
              dto.questionTypes,
            ),
          signal: pauseWatcher.signal,
          checkpoint: () => this.checkpointPause(processingJobId),
        });
        questions = completion.value;
        totalInputTokens = completion.inputTokens;
        totalOutputTokens = completion.outputTokens;
      }

      if (!savedResult) {
        job.generationResult = {
          questions,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        };
        await this.jobs.update(job.id, {
          // TypeORM's recursive partial type cannot represent arbitrary jsonb
          // records even though the Postgres column accepts this JSON value.
          generationResult: job.generationResult as never,
        });
      }
      await this.checkpointPause(job.id);
      await this.updateProgress(job, {
        stage: AiGenerationJobStage.SAVING_QUIZ,
      });
      await this.checkpointPause(job.id);
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
        generationResult: null,
        completedAt: new Date(),
        errorMessage: null,
        errorDetails: null,
      });
      const completedJobId = job.id;
      await this.cleanupArtifacts(job).catch((error: unknown) =>
        this.logger.warn(
          `Không thể dọn dữ liệu tạm của AI job ${completedJobId}: ${safeError(error)}`,
        ),
      );
    } catch (error) {
      if (error instanceof AiGenerationPausedError) return;
      // Abort do người dùng yêu cầu pause được SDK báo như lỗi mạng/abort.
      // Kiểm tra trạng thái DB một lần cuối để không biến pause thành retry
      // BullMQ, rồi để worker dừng sạch ngay cả khi API và worker khác process.
      if (await this.finalizePauseIfRequested(job.id)) return;
      // Lưu lỗi có cấu trúc ngay tại đây vì qua BullMQ (UnrecoverableError)
      // chỉ còn message dạng chuỗi, mất phân loại và validation issues.
      await this.jobs
        .update(job.id, {
          errorDetails: generationErrorDetails(error, job.stage, provider),
        })
        .catch(() => undefined);
      if (quizId) {
        await this.quizzes.remove(quizId, job.teacherId).catch(() => undefined);
        job.quizId = null;
        await this.jobs.update(job.id, { quizId: null });
      }
      throw error;
    } finally {
      pauseWatcher.close();
    }
  }

  async markRetrying(
    jobId: string,
    error: unknown,
    attemptCount: number,
  ): Promise<void> {
    // Chỉ cập nhật đúng attempt vừa thất bại. Nếu backoff đã hết và attempt
    // kế tiếp đang RUNNING, callback cũ không được ghi ngược trạng thái QUEUED.
    await this.jobs.update(
      {
        id: jobId,
        status: AiGenerationJobStatus.RUNNING,
        attemptCount,
      },
      {
        status: AiGenerationJobStatus.PENDING,
        stage: AiGenerationJobStage.QUEUED,
        errorMessage: `Lần xử lý ${attemptCount} chưa thành công, hệ thống đang tự thử lại: ${safeError(error)}`,
      },
    );
  }

  async markFailed(jobId: string, error: unknown): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (
      !job ||
      isTerminalGenerationStatus(job.status) ||
      job.status === AiGenerationJobStatus.PAUSE_REQUESTED ||
      job.status === AiGenerationJobStatus.PAUSED
    )
      return;
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
    // process() đã lưu error_details gốc; chỉ bổ sung khi lỗi xảy ra trước đó
    // (ví dụ không đọc được job) vì qua BullMQ error chỉ còn message.
    job.errorDetails ??= generationErrorDetails(error, job.stage, null);
    job.completedAt = new Date();
    await this.jobs.save(job);
    await this.cleanupArtifacts(job).catch(() => undefined);
  }

  async get(jobId: string, teacherId: string): Promise<AiGenerationJob> {
    const job = await this.ownedJob(jobId, teacherId);
    return this.responseFor(job);
  }

  private async ownedJob(
    jobId: string,
    teacherId: string,
  ): Promise<AiGenerationJobEntity> {
    const job = await this.jobs.findOne({ where: { id: jobId, teacherId } });
    if (!job) throw new NotFoundException('Tác vụ sinh quiz không tồn tại');
    return job;
  }

  private async responseFor(
    job: AiGenerationJobEntity,
  ): Promise<AiGenerationJob> {
    const provider = await this.providers
      .resolve(job.providerId)
      .catch(() => null);
    return this.toResponse(job, provider?.name ?? 'Provider đã tắt');
  }

  private async markPaused(jobId: string): Promise<void> {
    await this.jobs.update(
      { id: jobId, status: AiGenerationJobStatus.PAUSE_REQUESTED },
      {
        status: AiGenerationJobStatus.PAUSED,
        errorMessage: null,
        completedAt: null,
      },
    );
  }

  /**
   * Điểm ngắt bền vững theo DB. Watcher sẽ abort request SDK đang bay để UI
   * không chờ timeout provider; checkpoint này vẫn là hàng rào cuối trước mọi
   * request/lần ghi checkpoint tiếp theo.
   */
  private async checkpointPause(jobId: string): Promise<void> {
    const paused = await this.finalizePauseIfRequested(jobId);
    if (paused) throw new AiGenerationPausedError();
  }

  /**
   * Chuyển yêu cầu dừng thành checkpoint ổn định. Tách helper này khỏi
   * checkpoint để catch của request bị abort cũng có thể kết thúc job đúng
   * trạng thái thay vì để BullMQ retry nó.
   */
  private async finalizePauseIfRequested(jobId: string): Promise<boolean> {
    const current = await this.jobs.findOne({ where: { id: jobId } });
    if (!current) throw new NotFoundException('Tác vụ sinh quiz không tồn tại');
    if (current.status === AiGenerationJobStatus.PAUSE_REQUESTED) {
      await this.markPaused(jobId);
      return true;
    }
    return (
      current.status === AiGenerationJobStatus.PAUSED ||
      current.status === AiGenerationJobStatus.CANCELLED
    );
  }

  /**
   * Worker và API có thể là hai process/container khác nhau, vì vậy không
   * dùng cờ in-memory từ endpoint pause. Worker poll DB nhẹ trong lúc chạy để
   * abort request SDK hiện tại, còn checkpoint bên dưới lưu tiến độ đã có.
   */
  private watchPause(jobId: string): PauseWatcher {
    const controller = new AbortController();
    let closed = false;
    let checking = false;
    const check = () => {
      if (closed || checking || controller.signal.aborted) return;
      checking = true;
      void this.jobs
        .findOne({ where: { id: jobId } })
        .then((current) => {
          if (
            current?.status === AiGenerationJobStatus.PAUSE_REQUESTED ||
            current?.status === AiGenerationJobStatus.PAUSED ||
            current?.status === AiGenerationJobStatus.CANCELLED
          )
            controller.abort();
        })
        // DB có thể vừa restart; checkpoint/catch vẫn kiểm tra lại trước khi
        // quyết định retry nên watcher chỉ fail-open cho lần poll đó.
        .catch(() => undefined)
        .finally(() => {
          checking = false;
        });
    };
    check();
    const timer = setInterval(check, PAUSE_WATCH_INTERVAL_MS);
    timer.unref?.();
    return {
      signal: controller.signal,
      close: () => {
        closed = true;
        clearInterval(timer);
      },
    };
  }

  private async extractStoredSource(
    job: AiGenerationJobEntity,
    signal?: AbortSignal,
  ) {
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
    const extraction = await this.materialSource.extract(file, {
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
            failureCategory: page.failureCategory,
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
      checkpoint: () => this.checkpointPause(job.id),
      signal,
    });
    job.extractionReport = {
      totalPages: extraction.pages.length,
      textLayerPages: extraction.textLayerPages,
      aiPdfPages: extraction.aiPdfPages,
      aiVisionPages: extraction.aiVisionPages,
      failedPages: extraction.failedPages,
    };
    await this.jobs.update(job.id, {
      extractionReport: job.extractionReport,
    });
    return extraction;
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

  /**
   * Provider phân tích chunk đã chốt lúc tạo job. Job có thể được retry sau
   * khi admin tắt hoặc xóa provider đó; phân tích là nhiệm vụ tùy chọn nên khi
   * ấy quay về provider quiz thay vì để job chết.
   */
  private async resolveAnalysisProvider(
    job: AiGenerationJobEntity,
    quizProvider: Awaited<ReturnType<AiProviderService['resolve']>>,
  ): Promise<Awaited<ReturnType<AiProviderService['resolve']>>> {
    if (!job.analysisProviderId) return quizProvider;
    const provider = await this.providers
      .resolve(job.analysisProviderId)
      .catch(() => null);
    if (provider) return provider;
    this.logger.warn(
      `Provider phân tích ${job.analysisProviderId} của job ${job.id} không dùng được; quay về ${quizProvider.name}`,
    );
    return quizProvider;
  }

  private async analyzeDocumentChunks(
    job: AiGenerationJobEntity,
    dto: GenerateQuizWithAiDto,
    provider: Awaited<ReturnType<AiProviderService['resolve']>>,
    rows: AiGenerationChunkEntity[],
    signal?: AbortSignal,
  ): Promise<{
    analyses: QuizChunkAnalysis[];
    inputTokens: number;
    outputTokens: number;
  }> {
    const analysisByChunk = new Map<number, QuizChunkAnalysis>();
    for (const row of rows) {
      const saved = validateChunkAnalysis(row.analysis, row);
      if (saved) analysisByChunk.set(row.chunkIndex, saved);
    }
    let completed = analysisByChunk.size;
    await this.updateProgress(job, {
      stage: AiGenerationJobStage.ANALYZING_DOCUMENT,
      generationTotalChunks: rows.length,
      generationProcessedChunks: completed,
    });
    const reportProgress = serializedProgress(async (processed) =>
      this.updateProgress(job, {
        stage: AiGenerationJobStage.ANALYZING_DOCUMENT,
        generationTotalChunks: rows.length,
        generationProcessedChunks: processed,
      }),
    );
    const pendingRows = rows.filter(
      (row) => !analysisByChunk.has(row.chunkIndex),
    );
    await mapWithConcurrency(
      pendingRows,
      this.analysisConcurrency(),
      async (row) => {
        try {
          await this.checkpointPause(job.id);
          const completion = await this.completeCanonicalJson({
            provider,
            system: chunkAnalysisSystemPrompt(),
            prompt: chunkAnalysisUserPrompt(dto, chunkFromRow(row)),
            usageContext: {
              source: 'quiz_generation',
              referenceId: job.id,
              userId: job.teacherId,
            },
            schema: chunkAnalysisOutputSchema(),
            parse: (value) => requireChunkAnalysis(value, row),
            signal,
            checkpoint: () => this.checkpointPause(job.id),
          });
          const analysis = completion.value;
          row.analysis = analysis;
          row.analysisInputTokens = completion.inputTokens;
          row.analysisOutputTokens = completion.outputTokens;
          row.lastError = null;
          await this.chunks.save(row);
          analysisByChunk.set(row.chunkIndex, analysis);
          completed += 1;
          await reportProgress(completed);
          await this.checkpointPause(job.id);
          return analysis;
        } catch (error) {
          if (error instanceof AiGenerationPausedError) throw error;
          row.lastError = safeError(error);
          await this.chunks.save(row);
          throw error;
        }
      },
    );
    const analyses = rows.map((row) => {
      const analysis = analysisByChunk.get(row.chunkIndex);
      if (!analysis)
        throw new BadGatewayException(
          `Thiếu phân tích cho phần ${row.chunkIndex + 1}`,
        );
      return analysis;
    });
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
    signal?: AbortSignal,
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
    const completion = await this.completeCanonicalJson({
      provider,
      system: quizBlueprintSystemPrompt(),
      prompt: quizBlueprintUserPrompt(dto, analyses, distribution),
      usageContext: {
        source: 'quiz_generation',
        referenceId: job.id,
        userId: job.teacherId,
      },
      schema: quizBlueprintOutputSchema(),
      parse: (value) => requireQuizBlueprint(value, analyses, dto.topic),
      signal,
      checkpoint: () => this.checkpointPause(job.id),
    });
    const blueprint = completion.value;
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
    signal?: AbortSignal,
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
    const candidateCount = qualityCandidateCount(
      dto.questionCount,
      selectedRows.length,
    );
    const questionsByChunk = new Map<number, QualityQuestion[]>();
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
          candidateCount,
          dto.questionTypes,
          blueprint,
          undefined,
          row.text,
        );
        if (saved) {
          questionsByChunk.set(row.chunkIndex, saved);
        }
      }
    }
    let completed = questionsByChunk.size;
    await this.updateProgress(job, {
      stage: AiGenerationJobStage.GENERATING_CANDIDATES,
      generationTotalChunks: selectedRows.length,
      generationProcessedChunks: completed,
    });
    const reportProgress = serializedProgress(async (processed) =>
      this.updateProgress(job, {
        stage: AiGenerationJobStage.GENERATING_CANDIDATES,
        generationTotalChunks: selectedRows.length,
        generationProcessedChunks: processed,
      }),
    );
    const pendingRows = selectedRows.filter(
      (row) => !questionsByChunk.has(row.chunkIndex),
    );
    await mapWithConcurrency(
      pendingRows,
      this.candidateConcurrency(),
      async (row) => {
        await this.checkpointPause(job.id);
        const analysis = analysisByChunk.get(row.chunkIndex)!;
        row.status = AiGenerationChunkStatus.PROCESSING;
        row.attempts += 1;
        row.lastError = null;
        await this.chunks.save(row);
        try {
          const completion = await this.completeCanonicalJson({
            provider,
            system: qualityCandidateSystemPrompt(),
            prompt: qualityCandidateUserPrompt(
              dto,
              chunkFromRow(row),
              analysis,
              blueprint,
              candidateCount,
              distribution,
            ),
            usageContext: {
              source: 'quiz_generation',
              referenceId: job.id,
              userId: job.teacherId,
            },
            schema: qualityQuestionsOutputSchema(
              dto.questionTypes,
              candidateCount,
            ),
            parse: (value) =>
              requireQualityQuestions(
                value,
                candidateCount,
                dto.questionTypes,
                blueprint,
                undefined,
                row.text,
              ),
            signal,
            checkpoint: () => this.checkpointPause(job.id),
          });
          const candidates = completion.value;
          row.status = AiGenerationChunkStatus.COMPLETED;
          row.candidateQuestions = candidates;
          row.inputTokens = completion.inputTokens;
          row.outputTokens = completion.outputTokens;
          row.lastError = null;
          await this.chunks.save(row);
          questionsByChunk.set(row.chunkIndex, candidates);
          completed += 1;
          await reportProgress(completed);
          await this.checkpointPause(job.id);
          return candidates;
        } catch (error) {
          if (error instanceof AiGenerationPausedError) throw error;
          row.status = AiGenerationChunkStatus.FAILED;
          row.lastError = safeError(error);
          await this.chunks.save(row);
          throw error;
        }
      },
    );
    const questions = selectedRows.flatMap(
      (row) => questionsByChunk.get(row.chunkIndex) ?? [],
    );
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
    signal?: AbortSignal,
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
    const completion = await this.completeCanonicalJson({
      provider,
      system: qualityReviewSystemPrompt(),
      prompt: qualityReviewUserPrompt(dto, blueprint, candidates, distribution),
      usageContext: {
        source: 'quiz_generation',
        referenceId: job.id,
        userId: job.teacherId,
      },
      schema: qualityQuestionsOutputSchema(
        dto.questionTypes,
        dto.questionCount,
      ),
      parse: (value) =>
        requireQualityQuestions(
          value,
          dto.questionCount,
          dto.questionTypes,
          blueprint,
          distribution,
          pages.map((page) => page.text).join('\n'),
        ),
      signal,
      checkpoint: () => this.checkpointPause(job.id),
    });
    return {
      questions: completion.value,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
    };
  }

  /**
   * Gọi provider rồi validate bằng canonical schema nghiệp vụ. Khi JSON hỏng
   * hoặc vi phạm nghiệp vụ, cho đúng MỘT lần repair kèm danh sách lỗi theo
   * field; repair vẫn thất bại thì ném lỗi không-retry với đầy đủ issues.
   * Không lặp repair vô hạn, không dùng retry request thông thường cho loại
   * lỗi nội dung này.
   */
  private async completeCanonicalJson<T>(args: {
    provider: AiProviderEntity;
    system: string;
    prompt: string;
    usageContext: AiUsageContext;
    schema: Record<string, unknown>;
    parse: (value: unknown) => T;
    signal?: AbortSignal;
    checkpoint?: () => Promise<void>;
  }): Promise<{ value: T; inputTokens: number; outputTokens: number }> {
    const first = await this.tryCompleteParse<T>(args, args.prompt);
    if (first.ok) return first;
    // Nếu output đầu tiên hỏng, đừng mở request repair mới sau khi người dùng
    // đã bấm dừng. Đây là chỗ trước đây có thể khiến pause chờ thêm một call.
    await args.checkpoint?.();
    this.logger.warn(
      `AI output không hợp lệ, repair 1 lần: provider=${args.provider.name} model=${args.provider.model} referenceId=${args.usageContext.referenceId ?? 'none'} issues=${first.issues.join(' | ').slice(0, 1500)}`,
    );
    const second = await this.tryCompleteParse<T>(
      args,
      repairPrompt(args.prompt, first.issues),
    );
    if (second.ok)
      return {
        value: second.value,
        inputTokens: first.inputTokens + second.inputTokens,
        outputTokens: first.outputTokens + second.outputTokens,
      };
    throw new AiRequestError(
      `AI trả kết quả không hợp lệ sau 1 lần sửa: ${second.issues.join('; ').slice(0, 1500)}`,
      {
        category: 'canonical_validation_error',
        retryable: false,
        provider: args.provider.name,
        model: args.provider.model,
        validationIssues: second.issues,
      },
    );
  }

  private async tryCompleteParse<T>(
    args: {
      provider: AiProviderEntity;
      system: string;
      usageContext: AiUsageContext;
      schema: Record<string, unknown>;
      parse: (value: unknown) => T;
      signal?: AbortSignal;
    },
    prompt: string,
  ): Promise<
    | { ok: true; value: T; inputTokens: number; outputTokens: number }
    | { ok: false; issues: string[]; inputTokens: number; outputTokens: number }
  > {
    let completion: Awaited<ReturnType<AiModelClientService['completeJson']>>;
    try {
      completion = await this.client.completeJson(
        args.provider,
        args.system,
        prompt,
        {
          ...args.usageContext,
          ...(args.signal ? { abortSignal: args.signal } : {}),
        },
        args.schema,
      );
    } catch (error) {
      // JSON hỏng/bị cắt là lỗi nội dung — đủ điều kiện repair; các lỗi
      // provider khác (HTTP, timeout, refusal) ném tiếp cho retry policy.
      if (
        error instanceof AiRequestError &&
        error.details.category === 'invalid_json_output'
      )
        return {
          ok: false,
          issues: [error.message],
          inputTokens: 0,
          outputTokens: 0,
        };
      throw error;
    }
    try {
      return {
        ok: true,
        value: args.parse(completion.value),
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
      };
    } catch (error) {
      if (
        error instanceof AiRequestError &&
        error.details.category === 'canonical_validation_error'
      )
        return {
          ok: false,
          issues: error.details.validationIssues.length
            ? error.details.validationIssues
            : [error.message],
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens,
        };
      throw error;
    }
  }

  private toResponse(
    job: AiGenerationJobEntity,
    providerName: string,
  ): AiGenerationJob {
    return {
      id: job.id,
      sourceType:
        job.requestPayload.sourceType === 'upload' ? 'upload' : 'prompt',
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
      extractionReport: job.extractionReport ?? null,
      sourceFileName: job.sourceOriginalName ?? null,
      sourceFileSize: job.sourceSize ?? null,
      sourceFileSha256: job.sourceSha256 ?? null,
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
    failureCategory: page.failureCategory ?? null,
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

function isTerminalGenerationStatus(status: AiGenerationJobStatus): boolean {
  return (
    status === AiGenerationJobStatus.SUCCEEDED ||
    status === AiGenerationJobStatus.FAILED ||
    status === AiGenerationJobStatus.CANCELLED
  );
}

function readGenerationResult(
  value: Record<string, unknown> | null | undefined,
  dto: GenerateQuizWithAiDto,
): GenerationResultCheckpoint | null {
  if (!value) return null;
  const inputTokens = Number(value.inputTokens);
  const outputTokens = Number(value.outputTokens);
  if (
    !Number.isInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isInteger(outputTokens) ||
    outputTokens < 0
  )
    return null;
  try {
    return {
      questions: validateGeneratedQuestions(
        { questions: value.questions },
        dto.questionCount,
        dto.questionTypes,
      ),
      inputTokens,
      outputTokens,
    };
  } catch {
    return null;
  }
}

export function validateGeneratedQuestions(
  value: unknown,
  expected: number,
  allowed?: SharedQuestionType[],
): GeneratedQuestion[] {
  const issues: string[] = [];
  const questions = (value as { questions?: unknown })?.questions;
  if (!Array.isArray(questions))
    throw canonicalValidationError('Bộ câu hỏi AI không hợp lệ', [
      'questions: thiếu hoặc không phải mảng',
    ]);
  if (questions.length !== expected)
    issues.push(
      `questions: cần đúng ${expected} câu hỏi, nhận được ${questions.length}`,
    );
  const allowedTypes = new Set(
    allowed?.length
      ? allowed
      : ['single_choice', 'true_false', 'multiple_choice'],
  );
  const parsed: GeneratedQuestion[] = [];
  questions.forEach((raw, index) => {
    const path = `questions[${index}]`;
    try {
      const row = raw as Partial<GeneratedQuestion>;
      const options = row.options;
      if (
        !row ||
        typeof row.content !== 'string' ||
        row.content.trim().length < 2 ||
        !allowedTypes.has(row.type as SharedQuestionType)
      )
        throw new Error(`${path}: nội dung hoặc loại câu hỏi không hợp lệ`);
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
        throw new Error(
          `${path}.options: yêu cầu tối thiểu 2 lựa chọn {content,isCorrect}, không dùng all/none of the above`,
        );
      const correct = options.filter((option) => option.isCorrect).length;
      const optionKeys = options.map((option) => normalized(option.content));
      if (new Set(optionKeys).size !== optionKeys.length)
        throw new Error(`${path}.options: có lựa chọn bị trùng nội dung`);
      if (
        (row.type === 'single_choice' &&
          (options.length !== 4 || correct !== 1)) ||
        (row.type === 'true_false' &&
          (options.length !== 2 || correct !== 1)) ||
        (row.type === 'multiple_choice' &&
          (options.length < 4 ||
            options.length > 6 ||
            correct < 2 ||
            correct >= options.length))
      )
        throw new Error(
          `${path}.options: số lựa chọn hoặc đáp án đúng không hợp lệ cho ${row.type} (nhận ${options.length} lựa chọn, ${correct} đáp án đúng)`,
        );
      parsed.push({
        type: row.type!,
        content: row.content.trim().slice(0, 5000),
        explanation: row.explanation?.trim().slice(0, 5000),
        options: options.map((option) => ({
          content: option.content.trim().slice(0, 1000),
          isCorrect: option.isCorrect,
        })),
      });
    } catch (error) {
      issues.push(issueMessage(error));
    }
  });
  if (issues.length)
    throw canonicalValidationError('Bộ câu hỏi AI không hợp lệ', issues);
  return parsed;
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
  try {
    return parseChunkAnalysis(value, row);
  } catch (error) {
    const issue = issueMessage(error);
    throw canonicalValidationError(
      `AI phân tích phần ${row.chunkIndex + 1} không hợp lệ`,
      [issue],
    );
  }
}

function validateChunkAnalysis(
  value: unknown,
  row: AiGenerationChunkEntity,
): QuizChunkAnalysis | null {
  try {
    return parseChunkAnalysis(value, row);
  } catch {
    return null;
  }
}

function parseChunkAnalysis(
  value: unknown,
  row: AiGenerationChunkEntity,
): QuizChunkAnalysis {
  const record = objectValue(value, 'kết quả phân tích');
  const chunkIndex = integerValue(
    record.chunkIndex,
    0,
    Number.MAX_SAFE_INTEGER,
    'chunkIndex',
  );
  if (chunkIndex !== row.chunkIndex)
    throw new Error(
      `chunkIndex: phải là ${row.chunkIndex}, nhận được ${chunkIndex}`,
    );
  const sectionType = enumValue(
    record.sectionType,
    [
      'core_content',
      'exercise',
      'front_matter',
      'table_of_contents',
      'copyright',
      'answer_key',
      'appendix',
      'other',
    ] as const,
    'sectionType',
  );
  const relevanceScore = integerValue(
    record.relevanceScore,
    0,
    100,
    'relevanceScore',
  );
  const summary = requiredText(record.summary, 1, 2000, 'summary');
  const excludedReason = textValue(record.excludedReason).slice(0, 1000);
  if (!Array.isArray(record.keyPoints) || record.keyPoints.length > 8)
    throw new Error('keyPoints: phải là mảng tối đa 8 phần tử');
  const keyPoints = record.keyPoints.map((raw, index) => {
    const path = `keyPoints[${index}]`;
    const point = objectValue(raw, path);
    const evidence = requiredText(point.evidence, 2, 800, `${path}.evidence`);
    const sourcePages = integerArray(
      point.sourcePages,
      1,
      `${path}.sourcePages`,
    );
    if (
      sourcePages.some(
        (page) =>
          (row.startPage !== null && page < row.startPage) ||
          (row.endPage !== null && page > row.endPage),
      )
    )
      throw new Error(
        `${path}.sourcePages: trang evidence nằm ngoài phạm vi chunk (${row.startPage ?? '?'}-${row.endPage ?? '?'})`,
      );
    return {
      title: requiredText(point.title, 2, 300, `${path}.title`),
      description: requiredText(
        point.description,
        2,
        1200,
        `${path}.description`,
      ),
      importance: integerValue(point.importance, 1, 5, `${path}.importance`),
      cognitiveLevels: enumArray(
        point.cognitiveLevels,
        ['remember', 'understand', 'apply'] as const,
        `${path}.cognitiveLevels`,
      ),
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
    relevanceScore: excludedSection
      ? Math.min(10, relevanceScore)
      : relevanceScore,
    summary,
    keyPoints: excludedSection ? [] : keyPoints,
    excludedReason:
      excludedSection && !excludedReason
        ? 'Nội dung phụ không dùng để đánh giá kiến thức trọng tâm'
        : excludedReason,
  };
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
    const stored = objectValue(value, 'quizBlueprint');
    const blueprint = requireQuizBlueprint(stored.blueprint, analyses, topic);
    return {
      blueprint,
      inputTokens: integerValue(
        stored.inputTokens,
        0,
        Number.MAX_SAFE_INTEGER,
        'quizBlueprint.inputTokens',
      ),
      outputTokens: integerValue(
        stored.outputTokens,
        0,
        Number.MAX_SAFE_INTEGER,
        'quizBlueprint.outputTokens',
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
    const record = objectValue(value, 'blueprint');
    const documentKind = enumValue(
      record.documentKind,
      [
        'english_reading',
        'english_grammar',
        'english_mixed',
        'general_subject',
      ] as const,
      'documentKind',
    );
    if (!Array.isArray(record.objectives) || !record.objectives.length)
      throw new Error('objectives: thiếu hoặc không phải mảng có phần tử');
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
      .map((raw, index) => {
        const path = `objectives[${index}]`;
        const objective = objectValue(raw, path);
        const id = requiredText(objective.id, 1, 40, `${path}.id`);
        if (ids.has(id)) throw new Error(`${path}.id: bị trùng "${id}"`);
        ids.add(id);
        const title = requiredText(objective.title, 2, 300, `${path}.title`);
        const description = requiredText(
          objective.description,
          2,
          1200,
          `${path}.description`,
        );
        if (
          !allowMetadata &&
          isLowValueMetadataQuestion(`${title} ${description}`)
        )
          return null;
        const sourceChunkIndexes = integerArray(
          objective.sourceChunkIndexes,
          0,
          `${path}.sourceChunkIndexes`,
        ).filter((chunkIndex) => validChunkIndexes.has(chunkIndex));
        if (!sourceChunkIndexes.length) return null;
        return {
          id,
          title,
          description,
          weight: integerValue(objective.weight, 1, 100, `${path}.weight`),
          sourceChunkIndexes,
          sourcePages: integerArray(
            objective.sourcePages,
            1,
            `${path}.sourcePages`,
          ),
          preferredCategories: enumArray(
            objective.preferredCategories,
            [
              'reading_comprehension',
              'vocabulary_in_context',
              'grammar',
              'core_concept',
              'application',
            ] as const,
            `${path}.preferredCategories`,
          ),
        };
      })
      .filter((objective): objective is QuizBlueprint['objectives'][number] =>
        Boolean(objective),
      );
    if (!objectives.length)
      throw new Error(
        'objectives: không còn mục tiêu trọng tâm hợp lệ (mỗi objective cần sourceChunkIndexes thuộc chunk có kiến thức và không dựa vào metadata)',
      );
    normalizeWeights(objectives);
    return {
      documentKind,
      language: requiredText(record.language, 1, 100, 'language'),
      overview: requiredText(record.overview, 2, 3000, 'overview'),
      targetAudience: requiredText(
        record.targetAudience,
        1,
        300,
        'targetAudience',
      ),
      objectives,
      excludedContent: stringArray(
        record.excludedContent,
        20,
        500,
        'excludedContent',
      ),
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
    if (error instanceof AiRequestError) throw error;
    const issue = issueMessage(error);
    throw canonicalValidationError('AI lập kế hoạch quiz không hợp lệ', [
      issue,
    ]);
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
  const issues: string[] = [];
  const parsed = parseQualityQuestions(
    value,
    expected,
    allowed,
    blueprint,
    distribution,
    sourceText,
    issues,
  );
  if (!parsed || issues.length)
    throw canonicalValidationError(
      'Bộ câu hỏi AI không đạt rubric về trọng tâm, bằng chứng hoặc đáp án',
      issues,
    );
  return parsed;
}

function validateQualityQuestions(
  value: unknown,
  expected: number,
  allowed: SharedQuestionType[] | undefined,
  blueprint: QuizBlueprint,
  distribution?: CognitiveDistribution,
  sourceText?: string,
): QualityQuestion[] | null {
  const issues: string[] = [];
  const parsed = parseQualityQuestions(
    value,
    expected,
    allowed,
    blueprint,
    distribution,
    sourceText,
    issues,
  );
  return !parsed || issues.length ? null : parsed;
}

/**
 * Parse + validate bộ câu hỏi theo canonical schema nghiệp vụ. Mỗi lỗi được
 * ghi vào `issues` kèm đường dẫn field (questions[2].options...) thay vì chỉ
 * trả "không hợp lệ" — đây là dữ liệu cho log, error_details và prompt repair.
 */
function parseQualityQuestions(
  value: unknown,
  expected: number,
  allowed: SharedQuestionType[] | undefined,
  blueprint: QuizBlueprint,
  distribution: CognitiveDistribution | undefined,
  sourceText: string | undefined,
  issues: string[],
): QualityQuestion[] | null {
  let questions: unknown;
  try {
    questions = objectValue(value, 'kết quả').questions;
  } catch (error) {
    issues.push(issueMessage(error));
    return null;
  }
  if (!Array.isArray(questions)) {
    issues.push('questions: thiếu hoặc không phải mảng');
    return null;
  }
  if (questions.length !== expected)
    issues.push(
      `questions: cần đúng ${expected} câu hỏi, nhận được ${questions.length}`,
    );
  const context = {
    allowedTypes: new Set(
      allowed?.length
        ? allowed
        : ['single_choice', 'true_false', 'multiple_choice'],
    ),
    objectiveById: new Map(
      blueprint.objectives.map((objective) => [objective.id, objective]),
    ),
    seen: new Set<string>(),
    blueprint,
    sourceText,
  };
  const parsed: QualityQuestion[] = [];
  questions.forEach((raw, index) => {
    try {
      parsed.push(parseQualityQuestion(raw, `questions[${index}]`, context));
    } catch (error) {
      issues.push(issueMessage(error));
    }
  });
  if (distribution && !issues.length) {
    for (const level of ['remember', 'understand', 'apply'] as const) {
      const actual = parsed.filter(
        (question) => question.cognitiveLevel === level,
      ).length;
      if (actual !== distribution[level])
        issues.push(
          `questions: cần ${distribution[level]} câu mức "${level}", nhận được ${actual}`,
        );
    }
  }
  return parsed;
}

function parseQualityQuestion(
  raw: unknown,
  path: string,
  context: {
    allowedTypes: Set<string>;
    objectiveById: Map<string, QuizBlueprint['objectives'][number]>;
    seen: Set<string>;
    blueprint: QuizBlueprint;
    sourceText?: string;
  },
): QualityQuestion {
  const question = objectValue(raw, path);
  const type = enumValue(
    question.type,
    ['single_choice', 'true_false', 'multiple_choice'] as const,
    `${path}.type`,
  );
  if (!context.allowedTypes.has(type))
    throw new Error(`${path}.type: loại "${type}" không được phép`);
  const content = requiredText(question.content, 2, 5000, `${path}.content`);
  const key = normalized(content);
  if (!key || context.seen.has(key))
    throw new Error(`${path}.content: câu hỏi bị trùng với câu khác`);
  context.seen.add(key);
  const objectiveId = requiredText(
    question.objectiveId,
    1,
    40,
    `${path}.objectiveId`,
  );
  const objective = context.objectiveById.get(objectiveId);
  if (!objective)
    throw new Error(
      `${path}.objectiveId: "${objectiveId}" không tồn tại trong blueprint`,
    );
  if (
    isLowValueMetadataQuestion(content) &&
    !isLowValueMetadataQuestion(`${objective.title} ${objective.description}`)
  )
    throw new Error(`${path}.content: hỏi metadata xuất bản không trọng tâm`);
  const cognitiveLevel = enumValue(
    question.cognitiveLevel,
    ['remember', 'understand', 'apply'] as const,
    `${path}.cognitiveLevel`,
  );
  const category = enumValue(
    question.category,
    [
      'reading_comprehension',
      'vocabulary_in_context',
      'grammar',
      'core_concept',
      'application',
    ] as const,
    `${path}.category`,
  );
  const explanation = requiredText(
    question.explanation,
    category === 'grammar' ? 40 : 15,
    5000,
    `${path}.explanation`,
  );
  if (!Array.isArray(question.options))
    throw new Error(`${path}.options: thiếu mảng lựa chọn`);
  const options = question.options.map((rawOption, optionIndex) => {
    const optionPath = `${path}.options[${optionIndex}]`;
    const option = objectValue(rawOption, optionPath);
    const optionContent = requiredText(
      option.content,
      1,
      1000,
      `${optionPath}.content`,
    );
    if (DISALLOWED_OPTION.test(optionContent))
      throw new Error(`${optionPath}: không dùng all/none of the above`);
    return {
      content: optionContent,
      isCorrect: booleanValue(option.isCorrect, `${optionPath}.isCorrect`),
    };
  });
  const optionKeys = options.map((option) => normalized(option.content));
  if (new Set(optionKeys).size !== optionKeys.length)
    throw new Error(`${path}.options: có lựa chọn bị trùng nội dung`);
  const correct = options.filter((option) => option.isCorrect).length;
  if (type === 'single_choice' && (options.length !== 4 || correct !== 1))
    throw new Error(
      `${path}.options: single_choice yêu cầu đúng 4 lựa chọn và 1 đáp án đúng (nhận ${options.length} lựa chọn, ${correct} đáp án đúng)`,
    );
  if (type === 'true_false' && (options.length !== 2 || correct !== 1))
    throw new Error(
      `${path}.options: true_false yêu cầu đúng 2 lựa chọn và 1 đáp án đúng (nhận ${options.length} lựa chọn, ${correct} đáp án đúng)`,
    );
  if (
    type === 'multiple_choice' &&
    (options.length < 4 ||
      options.length > 6 ||
      correct < 2 ||
      correct >= options.length)
  )
    throw new Error(
      `${path}.options: multiple_choice yêu cầu 4-6 lựa chọn, tối thiểu 2 đáp án đúng và tối thiểu 1 distractor (nhận ${options.length} lựa chọn, ${correct} đáp án đúng)`,
    );
  const sourcePages = integerArray(
    question.sourcePages,
    1,
    `${path}.sourcePages`,
    true,
  );
  if (sourcePages.some((page) => !objective.sourcePages.includes(page)))
    throw new Error(
      `${path}.sourcePages: trang nguồn không thuộc objective "${objectiveId}"`,
    );
  const sourceEvidence = textValue(question.sourceEvidence).slice(0, 800);
  if (
    context.blueprint.readingEvidenceRequired &&
    ['reading_comprehension', 'vocabulary_in_context'].includes(category)
  ) {
    if (!sourcePages.length || sourceEvidence.length < 5)
      throw new Error(
        `${path}.sourceEvidence: câu ${category} bắt buộc có sourcePages và sourceEvidence nguyên văn`,
      );
    if (
      context.sourceText &&
      !containsNormalized(context.sourceText, sourceEvidence)
    )
      throw new Error(
        `${path}.sourceEvidence: trích dẫn không có trong tài liệu nguồn`,
      );
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

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${path}: phải là JSON object`);
  return value as Record<string, unknown>;
}

function requiredText(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
): string {
  const text = textValue(value).trim();
  if (text.length < minimum)
    throw new Error(`${path}: chuỗi phải có tối thiểu ${minimum} ký tự`);
  return text.slice(0, maximum);
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean')
    throw new Error(`${path}: phải là boolean true/false`);
  return value;
}

function integerValue(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(
      `${path}: phải là số nguyên từ ${minimum} đến ${maximum === Number.MAX_SAFE_INTEGER ? '∞' : maximum}`,
    );
  return parsed;
}

function integerArray(
  value: unknown,
  minimum: number,
  path: string,
  allowEmpty = false,
): number[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length < 1))
    throw new Error(
      `${path}: phải là mảng số nguyên${allowEmpty ? '' : ' có tối thiểu 1 phần tử'}`,
    );
  const parsed = value.map((item) =>
    integerValue(item, minimum, Number.MAX_SAFE_INTEGER, path),
  );
  return [...new Set(parsed)];
}

function stringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
  path: string,
): string[] {
  if (!Array.isArray(value)) throw new Error(`${path}: phải là mảng chuỗi`);
  return value
    .slice(0, maximumItems)
    .map((item, index) =>
      requiredText(item, 1, maximumLength, `${path}[${index}]`),
    );
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value))
    throw new Error(
      `${path}: phải là một trong [${allowed.join(', ')}], nhận được "${String(value).slice(0, 60)}"`,
    );
  return value;
}

function enumArray<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number][] {
  if (!Array.isArray(value) || !value.length)
    throw new Error(`${path}: phải là mảng có tối thiểu 1 phần tử`);
  return [...new Set(value.map((item) => enumValue(item, allowed, path)))];
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

/**
 * Xếp hàng các lần ghi progress để response DB hoàn thành lệch thứ tự không
 * thể làm số đã xử lý bị lùi trong khi nhiều chunk kết thúc song song.
 */
function serializedProgress(
  update: (completed: number) => Promise<void>,
): (completed: number) => Promise<void> {
  let tail = Promise.resolve();
  return async (completed) => {
    const current = tail.then(() => update(completed));
    tail = current.catch(() => undefined);
    await current;
  };
}

function issueMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

/** Lỗi validation canonical: không retry, mang danh sách issues theo field. */
function canonicalValidationError(
  prefix: string,
  issues: string[],
): AiRequestError {
  return new AiRequestError(
    `${prefix}: ${issues.join('; ').slice(0, 1500) || 'dữ liệu không đúng schema'}`,
    {
      category: 'canonical_validation_error',
      retryable: false,
      validationIssues: issues,
    },
  );
}

/** Prompt repair MỘT lần: giữ nguyên yêu cầu gốc + danh sách lỗi theo field. */
function repairPrompt(prompt: string, issues: string[]): string {
  const list = issues
    .slice(0, 20)
    .map((issue) => `- ${issue.slice(0, 300)}`)
    .join('\n');
  return `${prompt}\n\nLần trả lời trước KHÔNG HỢP LỆ với các lỗi sau:\n${list}\nHãy tạo lại và trả về MỘT JSON hợp lệ đúng schema, khắc phục toàn bộ lỗi trên, không thêm bất kỳ nội dung nào ngoài JSON.`;
}

/** Gom lỗi bất kỳ thành cấu trúc chẩn đoán lưu vào ai_generation_jobs. */
function generationErrorDetails(
  error: unknown,
  stage: string,
  provider: AiProviderEntity | null,
): AiGenerationErrorDetails {
  const message = safeError(error);
  if (error instanceof AiRequestError)
    return {
      stage,
      message,
      ...error.details,
      provider: error.details.provider ?? provider?.name ?? null,
      model: error.details.model ?? provider?.model ?? null,
    };
  return {
    stage,
    message,
    category: 'request_failed',
    retryable: !isNonRetryableAiError(error),
    provider: provider?.name ?? null,
    model: provider?.model ?? null,
    statusCode: null,
    providerMessage: null,
    validationIssues: [],
  };
}
