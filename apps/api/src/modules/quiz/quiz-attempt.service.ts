import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  UserRole,
  type QuizAttempt as QuizAttemptResponse,
  type QuizAttemptResult,
  type QuizLeaderboardEntry,
} from '@zunibee/shared';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { QuizService } from './quiz.service';
import {
  QuizStatus,
  QuizVisibility,
  QuizLeaderboardMode,
  QuizResultReleaseMode,
} from './entities/quiz.entity';
import { QuizAttempt, QuizAttemptStatus } from './entities/quiz-attempt.entity';
import { QuizAttemptAnswer } from './entities/quiz-attempt-answer.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import {
  anonymizedLabel,
  compareAttemptsForRanking,
  gradeAnswer,
} from './quiz-scoring.util';

@Injectable()
export class QuizAttemptService {
  constructor(
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    @InjectRepository(QuizAttemptAnswer)
    private readonly answers: Repository<QuizAttemptAnswer>,
    @InjectRepository(QuizQuestion)
    private readonly questions: Repository<QuizQuestion>,
    private readonly quizService: QuizService,
  ) {}

  async start(
    dto: StartAttemptDto,
    currentUser: AuthenticatedUser | null,
  ): Promise<QuizAttemptResponse> {
    const quiz = await this.quizService.load(dto.quizId);
    await this.quizService.assertCanView(quiz, currentUser);
    if (quiz.status !== QuizStatus.PUBLISHED)
      throw new ForbiddenException('Quiz chưa được phát hành');
    if (currentUser && currentUser.role !== UserRole.STUDENT)
      throw new ForbiddenException('Chỉ học sinh mới có thể làm quiz');
    if (!currentUser && quiz.visibility !== QuizVisibility.PUBLIC)
      throw new ForbiddenException('Khách chỉ có thể làm quiz công khai');
    if (!currentUser && (!dto.guestToken || !dto.guestName))
      throw new BadRequestException('Khách cần nhập tên và mã phiên');
    const now = new Date();
    if (quiz.opensAt && now < quiz.opensAt)
      throw new ForbiddenException('Quiz chưa đến thời gian mở');
    if (quiz.dueAt && now >= quiz.dueAt)
      throw new ForbiddenException('Quiz đã hết hạn');
    const guestTokenHash = dto.guestToken
      ? hashGuestToken(dto.guestToken)
      : undefined;
    const identityWhere:
      FindOptionsWhere<QuizAttempt> | FindOptionsWhere<QuizAttempt>[] =
      currentUser
        ? { quizId: quiz.id, userId: currentUser.id }
        : [
            { quizId: quiz.id, guestToken: guestTokenHash },
            // Tương thích lượt guest đã tạo trước khi token được hash.
            { quizId: quiz.id, guestToken: dto.guestToken },
          ];
    const existing = await this.attempts.findOne({
      where: { ...identityWhere, status: QuizAttemptStatus.IN_PROGRESS },
      relations: { quiz: { questions: { options: true } }, answers: true },
    });
    if (existing) {
      if (!currentUser && existing.guestToken !== guestTokenHash) {
        existing.guestToken = guestTokenHash!;
        await this.attempts.save(existing);
      }
      await this.sync(existing);
      return this.toAttempt(existing);
    }
    const count = await this.attempts.count({ where: identityWhere });
    if (quiz.maxAttempts !== null && count >= quiz.maxAttempts)
      throw new ForbiddenException('Bạn đã hết lượt làm quiz');
    const expiresAt = quiz.timeLimitSeconds
      ? new Date(now.getTime() + quiz.timeLimitSeconds * 1000)
      : null;
    const attempt = this.attempts.create({
      quizId: quiz.id,
      quiz,
      userId: currentUser?.id ?? null,
      guestToken: currentUser ? null : guestTokenHash!,
      guestName: currentUser ? null : dto.guestName!.trim(),
      attemptNumber: count + 1,
      status: QuizAttemptStatus.IN_PROGRESS,
      startedAt: now,
      submittedAt: null,
      expiresAt,
      score: null,
      maxScore: quiz.totalScore.toFixed(2),
      timeTakenSeconds: null,
      answers: [],
    });
    try {
      await this.attempts.save(attempt);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.attempts.findOne({
        where: { ...identityWhere, status: QuizAttemptStatus.IN_PROGRESS },
        relations: { quiz: { questions: { options: true } }, answers: true },
      });
      if (!raced) throw error;
      return this.toAttempt(raced);
    }
    return this.toAttempt(attempt);
  }

  async get(
    id: string,
    user: AuthenticatedUser | null,
    guestToken?: string,
  ): Promise<QuizAttemptResponse> {
    const attempt = await this.load(id);
    this.assertIdentity(attempt, user, guestToken);
    await this.sync(attempt);
    return this.toAttempt(attempt);
  }

  async saveAnswer(
    id: string,
    questionId: string,
    dto: SaveAnswerDto,
    user: AuthenticatedUser | null,
    guestToken?: string,
  ): Promise<QuizAttemptResponse> {
    const attempt = await this.load(id);
    this.assertIdentity(attempt, user, guestToken);
    await this.sync(attempt);
    if (attempt.status !== QuizAttemptStatus.IN_PROGRESS)
      throw new ForbiddenException('Lượt làm đã kết thúc');
    const question = attempt.quiz.questions.find(
      (item) => item.id === questionId,
    );
    if (!question) throw new NotFoundException('Câu hỏi không thuộc quiz này');
    const valid = new Set(question.options.map((option) => option.id));
    if (dto.selectedOptionIds.some((optionId) => !valid.has(optionId)))
      throw new BadRequestException('Lựa chọn không thuộc câu hỏi');
    let answer = attempt.answers.find((item) => item.questionId === questionId);
    answer ??= this.answers.create({
      attemptId: id,
      questionId,
      selectedOptionIds: [],
      isCorrect: null,
      scoreAwarded: '0',
      answeredAt: new Date(),
    });
    answer.selectedOptionIds = [...new Set(dto.selectedOptionIds)];
    answer.answeredAt = new Date();
    await this.answers.save(answer);
    attempt.answers = [
      ...attempt.answers.filter((item) => item.questionId !== questionId),
      answer,
    ];
    return this.toAttempt(attempt);
  }

  async submit(
    id: string,
    user: AuthenticatedUser | null,
    guestToken?: string,
  ): Promise<QuizAttemptResult> {
    const attempt = await this.load(id);
    this.assertIdentity(attempt, user, guestToken);
    await this.sync(attempt);
    if (attempt.status === QuizAttemptStatus.IN_PROGRESS)
      await this.gradeAndSubmit(attempt, new Date());
    return this.toResult(attempt, user?.id ?? null);
  }

  async result(
    id: string,
    user: AuthenticatedUser | null,
    guestToken?: string,
  ): Promise<QuizAttemptResult> {
    const attempt = await this.load(id);
    this.assertIdentity(attempt, user, guestToken);
    await this.sync(attempt);
    if (attempt.status === QuizAttemptStatus.IN_PROGRESS)
      throw new ForbiddenException('Lượt làm chưa hoàn thành');
    return this.toResult(attempt, user?.id ?? null);
  }

  async mine(quizId: string, userId: string): Promise<QuizAttemptResult[]> {
    const rows = await this.attempts.find({
      where: { quizId, userId },
      relations: { quiz: { questions: { options: true } }, answers: true },
      order: { attemptNumber: 'DESC' },
      take: 100,
    });
    for (const row of rows) await this.sync(row);
    return rows
      .filter((row) => row.status !== QuizAttemptStatus.IN_PROGRESS)
      .map((row) => this.toResult(row, userId));
  }

  async leaderboard(
    quizId: string,
    user: AuthenticatedUser | null,
  ): Promise<QuizLeaderboardEntry[]> {
    const quiz = await this.quizService.load(quizId);
    await this.quizService.assertCanView(quiz, user);
    if (
      quiz.leaderboardMode === QuizLeaderboardMode.HIDDEN &&
      quiz.teacherId !== user?.id
    )
      throw new ForbiddenException('Bảng xếp hạng đang được ẩn');
    const inProgress = await this.attempts.find({
      where: { quizId, status: QuizAttemptStatus.IN_PROGRESS },
      relations: { quiz: { questions: { options: true } }, answers: true },
      take: 1_000,
    });
    for (const attempt of inProgress) await this.sync(attempt);
    const rows = await this.attempts.find({
      where: { quizId, status: QuizAttemptStatus.SUBMITTED },
      take: 10_000,
    });
    const best = new Map<string, QuizAttempt>();
    for (const row of rows) {
      const key = row.userId ?? row.guestToken!;
      const current = best.get(key);
      if (!current || compareAttemptsForRanking(row, current) < 0)
        best.set(key, row);
    }
    return [...best.values()]
      .sort(compareAttemptsForRanking)
      .slice(0, 100)
      .map((row, index) => ({
        rank: index + 1,
        label: anonymizedLabel(quizId, row.userId ?? row.guestToken!),
        score: Number(row.score),
        maxScore: Number(row.maxScore),
        timeTakenSeconds: row.timeTakenSeconds ?? 0,
        submittedAt: row.submittedAt?.toISOString() ?? '',
      }));
  }

  private async load(id: string): Promise<QuizAttempt> {
    const attempt = await this.attempts.findOne({
      where: { id },
      relations: {
        quiz: { questions: { options: true } },
        answers: true,
        user: true,
      },
      order: {
        quiz: {
          questions: { displayOrder: 'ASC', options: { displayOrder: 'ASC' } },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Lượt làm không tồn tại');
    return attempt;
  }
  private assertIdentity(
    attempt: QuizAttempt,
    user: AuthenticatedUser | null,
    guestToken?: string,
  ) {
    if (attempt.quiz.teacherId === user?.id) return;
    if (attempt.userId) {
      if (attempt.userId === user?.id) return;
      throw new ForbiddenException('Bạn không có quyền truy cập lượt làm này');
    }
    if (
      user ||
      !guestToken ||
      !matchesGuestToken(attempt.guestToken, guestToken)
    ) {
      throw new ForbiddenException('Mã truy cập lượt làm không hợp lệ');
    }
  }
  private deadline(attempt: QuizAttempt): Date | null {
    const values = [attempt.expiresAt, attempt.quiz.dueAt].filter(
      (date): date is Date => !!date,
    );
    return values.length
      ? new Date(Math.min(...values.map((date) => date.getTime())))
      : null;
  }
  private async sync(attempt: QuizAttempt) {
    const deadline = this.deadline(attempt);
    if (
      attempt.status === QuizAttemptStatus.IN_PROGRESS &&
      deadline &&
      new Date() >= deadline
    )
      await this.gradeAndSubmit(attempt, deadline);
  }
  private async gradeAndSubmit(attempt: QuizAttempt, submittedAt: Date) {
    let total = 0;
    for (const question of attempt.quiz.questions) {
      let answer = attempt.answers.find(
        (item) => item.questionId === question.id,
      );
      answer ??= this.answers.create({
        attemptId: attempt.id,
        questionId: question.id,
        selectedOptionIds: [],
        answeredAt: submittedAt,
      });
      const grade = gradeAnswer(question, answer.selectedOptionIds);
      answer.isCorrect = grade.isCorrect;
      answer.scoreAwarded = grade.scoreAwarded.toFixed(2);
      total += grade.scoreAwarded;
      await this.answers.save(answer);
      if (!attempt.answers.some((item) => item.questionId === question.id))
        attempt.answers.push(answer);
    }
    attempt.status = QuizAttemptStatus.SUBMITTED;
    attempt.submittedAt = submittedAt;
    attempt.score = total.toFixed(2);
    attempt.timeTakenSeconds = Math.max(
      0,
      Math.floor((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000),
    );
    await this.attempts.save(attempt);
  }
  private toAttempt(attempt: QuizAttempt): QuizAttemptResponse {
    return {
      id: attempt.id,
      quizId: attempt.quizId,
      quizTitle: attempt.quiz.title,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      deadlineAt: this.deadline(attempt)?.toISOString() ?? null,
      score: attempt.score === null ? null : Number(attempt.score),
      maxScore: Number(attempt.maxScore),
      questions: attempt.quiz.questions.map((q) => ({
        id: q.id,
        type: q.type,
        content: q.content,
        explanation: null,
        showExplanation: false,
        score: Number(q.score),
        displayOrder: q.displayOrder,
        options: q.options.map((o) => ({
          id: o.id,
          content: o.content,
          displayOrder: o.displayOrder,
        })),
      })),
      answers: Object.fromEntries(
        attempt.answers.map((a) => [a.questionId, a.selectedOptionIds]),
      ),
    };
  }
  private toResult(
    attempt: QuizAttempt,
    viewerId: string | null,
  ): QuizAttemptResult {
    const teacher = attempt.quiz.teacherId === viewerId;
    const released =
      teacher ||
      attempt.quiz.resultReleaseMode === QuizResultReleaseMode.IMMEDIATELY ||
      (attempt.quiz.resultReleaseMode === QuizResultReleaseMode.AFTER_DUE &&
        Boolean(attempt.quiz.dueAt && new Date() >= attempt.quiz.dueAt));
    const showCorrect = teacher || attempt.quiz.showCorrectAnswers;
    const showExplanations = teacher || attempt.quiz.showExplanations;
    return {
      attemptId: attempt.id,
      quizId: attempt.quizId,
      quizTitle: attempt.quiz.title,
      status: attempt.status,
      isReleased: released,
      score: released ? Number(attempt.score ?? 0) : null,
      maxScore: Number(attempt.maxScore),
      timeTakenSeconds: attempt.timeTakenSeconds ?? 0,
      answers: released
        ? attempt.quiz.questions.map((q) => {
            const answer = attempt.answers.find(
              (item) => item.questionId === q.id,
            );
            return {
              questionId: q.id,
              content: q.content,
              selectedOptionIds: answer?.selectedOptionIds ?? [],
              correctOptionIds: showCorrect
                ? q.options.filter((o) => o.isCorrect).map((o) => o.id)
                : [],
              isCorrect: showCorrect ? (answer?.isCorrect ?? false) : null,
              scoreAwarded: showCorrect ? Number(answer?.scoreAwarded ?? 0) : 0,
              explanation:
                showExplanations && q.showExplanation ? q.explanation : null,
            };
          })
        : [],
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; driverError?: { code?: string } };
  return value.code === '23505' || value.driverError?.code === '23505';
}

function hashGuestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function matchesGuestToken(stored: string | null, candidate: string): boolean {
  if (!stored) return false;
  const hashed = hashGuestToken(candidate);
  return safeEqual(stored, hashed) || safeEqual(stored, candidate);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
