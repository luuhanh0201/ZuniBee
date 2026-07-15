import {
  BadGatewayException,
  Injectable,
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
import { QuizService } from '@/modules/quiz/quiz.service';
import { QuizQuestionType } from '@/modules/quiz/entities/quiz-question.entity';
import { AiProviderService } from './ai-provider.service';
import { AiCreditService } from './ai-credit.service';
import { AiModelClientService } from './ai-model-client.service';
import { AiMaterialSourceService } from './ai-material-source.service';
import {
  AiGenerationJobEntity,
  AiGenerationJobStage,
  AiGenerationJobStatus,
} from './entities/ai-generation-job.entity';
import { GenerateQuizWithAiDto } from './dto/generate-quiz-with-ai.dto';

type GeneratedQuestion = {
  type: SharedQuestionType;
  content: string;
  explanation?: string;
  options: Array<{ content: string; isCorrect: boolean }>;
};

@Injectable()
export class AiQuizGenerationService {
  constructor(
    @InjectRepository(AiGenerationJobEntity)
    private readonly jobs: Repository<AiGenerationJobEntity>,
    private readonly providers: AiProviderService,
    private readonly credits: AiCreditService,
    private readonly client: AiModelClientService,
    private readonly materialSource: AiMaterialSourceService,
    private readonly quizzes: QuizService,
  ) {}
  async generate(
    teacherId: string,
    dto: GenerateQuizWithAiDto,
    sourceFile?: Express.Multer.File,
  ): Promise<GenerateQuizWithAiResponse> {
    const provider = await this.providers.resolveQuiz();
    const visionProvider =
      dto.sourceType === 'upload'
        ? await this.providers.resolveVision()
        : undefined;
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
        quizId: null,
        status: AiGenerationJobStatus.PENDING,
        stage: AiGenerationJobStage.QUEUED,
        documentTotalPages: null,
        documentProcessedPages: 0,
        requestPayload: sanitizeRequest(dto, sourceFile),
        reservedCredits: reserved,
        chargedCredits: 0,
        inputTokens: 0,
        outputTokens: 0,
        errorMessage: null,
        completedAt: null,
      }),
    );
    try {
      await this.credits.reserve(
        teacherId,
        'quiz_generation',
        job.id,
        reserved,
      );
    } catch (error) {
      job.status = AiGenerationJobStatus.FAILED;
      job.stage = AiGenerationJobStage.FAILED;
      job.errorMessage = safeError(error);
      job.completedAt = new Date();
      await this.jobs.save(job);
      throw error;
    }
    job.status = AiGenerationJobStatus.RUNNING;
    job.stage =
      dto.sourceType === 'upload'
        ? AiGenerationJobStage.READING_DOCUMENT
        : AiGenerationJobStage.GENERATING_QUIZ;
    await this.jobs.save(job);
    let quizId: string | null = null;
    try {
      const source =
        dto.sourceType === 'upload'
          ? await this.materialSource.extract(sourceFile, {
              provider: visionProvider!,
              referenceId: job.id,
              userId: teacherId,
              onProgress: async ({ totalPages, processedPages }) => {
                await this.updateProgress(job, {
                  stage: AiGenerationJobStage.READING_DOCUMENT,
                  documentTotalPages: totalPages,
                  documentProcessedPages: processedPages,
                });
              },
            })
          : null;
      await this.updateProgress(job, {
        stage: AiGenerationJobStage.GENERATING_QUIZ,
      });
      const completion = await this.client.completeJson(
        provider,
        generationSystemPrompt(),
        generationUserPrompt(dto, source?.text ?? null),
        { source: 'quiz_generation', referenceId: job.id, userId: teacherId },
        generationOutputSchema(dto.questionTypes),
      );
      const questions = validateGeneratedQuestions(
        completion.value,
        dto.questionCount,
        dto.questionTypes,
      );
      await this.updateProgress(job, {
        stage: AiGenerationJobStage.SAVING_QUIZ,
      });
      let quiz = await this.quizzes.create(teacherId, {
        title: dto.title,
        description: dto.description,
      });
      quizId = quiz.id;
      for (const question of questions) {
        quiz = await this.quizzes.addQuestion(quiz.id, teacherId, {
          type: question.type as QuizQuestionType,
          content: question.content,
          explanation: question.explanation ?? null,
          showExplanation: true,
          options: question.options,
        });
      }
      const totalInputTokens =
        completion.inputTokens + (source?.visionInputTokens ?? 0);
      const totalOutputTokens =
        completion.outputTokens + (source?.visionOutputTokens ?? 0);
      const charged = calculateCharge(
        provider.baseCreditCost,
        provider.creditCostPer1kTokens,
        totalInputTokens + totalOutputTokens,
        reserved,
      );
      await this.credits.settle(
        teacherId,
        'quiz_generation',
        job.id,
        reserved,
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
      return {
        job: this.toResponse(job, provider.name),
        quiz,
        credit: await this.credits.get(teacherId),
      };
    } catch (error) {
      if (quizId)
        await this.quizzes.remove(quizId, teacherId).catch(() => undefined);
      await this.credits.release(
        teacherId,
        'quiz_generation',
        job.id,
        reserved,
      );
      job.status = AiGenerationJobStatus.FAILED;
      job.stage = AiGenerationJobStage.FAILED;
      job.errorMessage = safeError(error);
      job.completedAt = new Date();
      await this.jobs.save(job);
      throw error;
    }
  }
  async get(jobId: string, teacherId: string): Promise<AiGenerationJob> {
    const job = await this.jobs.findOne({ where: { id: jobId, teacherId } });
    if (!job) throw new NotFoundException('Tác vụ sinh quiz không tồn tại');
    const provider = await this.providers
      .resolve(job.providerId)
      .catch(() => null);
    return this.toResponse(job, provider?.name ?? 'Provider đã tắt');
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
    updates: {
      stage?: AiGenerationJobStage;
      documentTotalPages?: number | null;
      documentProcessedPages?: number;
    },
  ): Promise<void> {
    Object.assign(job, updates);
    await this.jobs.update(job.id, updates);
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
          typeof option?.isCorrect !== 'boolean',
      )
    )
      throw new BadGatewayException(
        `Câu ${index + 1} phải có ít nhất 2 lựa chọn hợp lệ`,
      );
    const correct = options.filter((option) => option.isCorrect).length;
    if (correct < 1 || (row.type !== 'multiple_choice' && correct !== 1))
      throw new BadGatewayException(
        `Câu ${index + 1} có số đáp án đúng không hợp lệ`,
      );
    if (row.type === 'true_false' && options.length !== 2)
      throw new BadGatewayException(
        `Câu ${index + 1} dạng Đúng/Sai phải có 2 lựa chọn`,
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
function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(
    0,
    2000,
  );
}
