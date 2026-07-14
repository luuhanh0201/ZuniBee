import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QuizWeaknessInsight } from '@zunibee/shared';
import { Quiz } from '@/modules/quiz/entities/quiz.entity';
import {
  QuizAttempt,
  QuizAttemptStatus,
} from '@/modules/quiz/entities/quiz-attempt.entity';
import { QuizAttemptAnswer } from '@/modules/quiz/entities/quiz-attempt-answer.entity';
import { AiProviderService } from './ai-provider.service';
import { AiCreditService } from './ai-credit.service';
import { AiModelClientService } from './ai-model-client.service';
import { AiGenerationJobStatus } from './entities/ai-generation-job.entity';
import { QuizWeaknessInsightEntity } from './entities/quiz-weakness-insight.entity';
import { calculateCharge } from './ai-quiz-generation.service';

@Injectable()
export class QuizWeaknessInsightService {
  constructor(
    @InjectRepository(QuizWeaknessInsightEntity)
    private readonly insights: Repository<QuizWeaknessInsightEntity>,
    @InjectRepository(Quiz) private readonly quizzes: Repository<Quiz>,
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    @InjectRepository(QuizAttemptAnswer)
    private readonly answers: Repository<QuizAttemptAnswer>,
    private readonly providers: AiProviderService,
    private readonly credits: AiCreditService,
    private readonly client: AiModelClientService,
  ) {}
  async latest(
    quizId: string,
    teacherId: string,
  ): Promise<QuizWeaknessInsight | null> {
    await this.assertOwner(quizId, teacherId);
    const row = await this.insights.findOne({
      where: { quizId },
      order: { createdAt: 'DESC' },
    });
    return row ? this.toResponse(row) : null;
  }
  async generate(
    quizId: string,
    teacherId: string,
  ): Promise<QuizWeaknessInsight> {
    const quiz = await this.assertOwner(quizId, teacherId);
    const provider = await this.providers.resolve();
    const submitted = await this.attempts.count({
      where: { quizId, status: QuizAttemptStatus.SUBMITTED },
    });
    if (!submitted)
      throw new BadRequestException(
        'Cần ít nhất một lượt nộp bài để phân tích điểm yếu',
      );
    const stats = await this.answers
      .createQueryBuilder('answer')
      .innerJoin(
        'answer.attempt',
        'attempt',
        'attempt.quiz_id = :quizId AND attempt.status = :status',
        { quizId, status: QuizAttemptStatus.SUBMITTED },
      )
      .innerJoin('answer.question', 'question')
      .select('question.id', 'questionId')
      .addSelect('question.content', 'content')
      .addSelect('COUNT(answer.id)', 'answered')
      .addSelect(
        'SUM(CASE WHEN answer.is_correct THEN 1 ELSE 0 END)',
        'correct',
      )
      .groupBy('question.id')
      .addGroupBy('question.content')
      .addGroupBy('question.display_order')
      .orderBy('question.display_order', 'ASC')
      .getRawMany();
    const reserve = Math.max(
      1,
      provider.baseCreditCost +
        Math.ceil((2000 + stats.length * 100) / 1000) *
          provider.creditCostPer1kTokens,
    );
    let insight = await this.insights.save(
      this.insights.create({
        quizId,
        teacherId,
        providerId: provider.id,
        status: AiGenerationJobStatus.PENDING,
        summary: null,
        strengths: [],
        weaknesses: [],
        recommendations: [],
        sampleSize: submitted,
        reservedCredits: reserve,
        chargedCredits: 0,
        errorMessage: null,
        generatedAt: null,
      }),
    );
    try {
      await this.credits.reserve(
        teacherId,
        'quiz_insight',
        insight.id,
        reserve,
      );
    } catch (error) {
      insight.status = AiGenerationJobStatus.FAILED;
      insight.errorMessage = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 2000);
      insight.generatedAt = new Date();
      await this.insights.save(insight);
      throw error;
    }
    insight.status = AiGenerationJobStatus.RUNNING;
    await this.insights.save(insight);
    try {
      const completion = await this.client.completeJson(
        provider,
        'Bạn là chuyên gia phân tích đánh giá giáo dục. Chỉ trả JSON gồm summary (string), strengths, weaknesses, recommendations (mỗi field là string[]). Không nêu tên cá nhân, không suy đoán ngoài dữ liệu.',
        `Quiz: ${quiz.title}. Có ${submitted} lượt nộp. Thống kê theo câu (answered/correct):\n${JSON.stringify(stats)}`,
        { source: 'quiz_insight', referenceId: insight.id, userId: teacherId },
        insightOutputSchema(),
      );
      const result = validateInsight(completion.value);
      const charged = calculateCharge(
        provider.baseCreditCost,
        provider.creditCostPer1kTokens,
        completion.inputTokens + completion.outputTokens,
        reserve,
      );
      await this.credits.settle(
        teacherId,
        'quiz_insight',
        insight.id,
        reserve,
        charged,
      );
      insight = await this.insights.save({
        ...insight,
        ...result,
        status: AiGenerationJobStatus.SUCCEEDED,
        chargedCredits: charged,
        generatedAt: new Date(),
        errorMessage: null,
      });
      return this.toResponse(insight);
    } catch (error) {
      await this.credits.release(
        teacherId,
        'quiz_insight',
        insight.id,
        reserve,
      );
      insight.status = AiGenerationJobStatus.FAILED;
      insight.errorMessage = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 2000);
      insight.generatedAt = new Date();
      await this.insights.save(insight);
      throw error;
    }
  }
  private async assertOwner(quizId: string, teacherId: string): Promise<Quiz> {
    const quiz = await this.quizzes.findOne({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz không tồn tại');
    if (quiz.teacherId !== teacherId)
      throw new ForbiddenException('Bạn không có quyền phân tích quiz này');
    return quiz;
  }
  private toResponse(row: QuizWeaknessInsightEntity): QuizWeaknessInsight {
    return {
      id: row.id,
      quizId: row.quizId,
      status: row.status,
      summary: row.summary,
      strengths: row.strengths,
      weaknesses: row.weaknesses,
      recommendations: row.recommendations,
      sampleSize: row.sampleSize,
      chargedCredits: row.chargedCredits,
      errorMessage: row.errorMessage,
      generatedAt: row.generatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function insightOutputSchema(): Record<string, unknown> {
  const stringList = {
    type: 'array',
    items: { type: 'string' },
  };
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      strengths: stringList,
      weaknesses: stringList,
      recommendations: stringList,
    },
    required: ['summary', 'strengths', 'weaknesses', 'recommendations'],
  };
}

export function validateInsight(
  value: unknown,
): Pick<
  QuizWeaknessInsightEntity,
  'summary' | 'strengths' | 'weaknesses' | 'recommendations'
> {
  const row = value as Record<string, unknown>;
  const array = (key: string) => {
    if (
      !Array.isArray(row?.[key]) ||
      (row[key] as unknown[]).some((item) => typeof item !== 'string')
    )
      throw new BadRequestException(`AI trả field ${key} không hợp lệ`);
    return (row[key] as string[])
      .map((item) => item.trim().slice(0, 1000))
      .filter(Boolean)
      .slice(0, 10);
  };
  if (typeof row?.summary !== 'string' || !row.summary.trim())
    throw new BadRequestException('AI trả summary không hợp lệ');
  return {
    summary: row.summary.trim().slice(0, 5000),
    strengths: array('strengths'),
    weaknesses: array('weaknesses'),
    recommendations: array('recommendations'),
  };
}
