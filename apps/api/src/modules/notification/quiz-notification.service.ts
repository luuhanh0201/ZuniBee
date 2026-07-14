import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import type {
  NotificationOutboxItem,
  QuizNotificationSummary,
} from '@zunibee/shared';
import {
  Quiz,
  QuizResultReleaseMode,
} from '@/modules/quiz/entities/quiz.entity';
import {
  QuizAttempt,
  QuizAttemptStatus,
} from '@/modules/quiz/entities/quiz-attempt.entity';
import { compareAttemptsForRanking } from '@/modules/quiz/quiz-scoring.util';
import {
  NotificationOutboxEntity,
  NotificationOutboxStatus,
} from './entities/notification-outbox.entity';
import { NotificationQueueService } from './notification-queue.service';

@Injectable()
export class QuizNotificationService {
  constructor(
    @InjectRepository(NotificationOutboxEntity)
    private readonly outbox: Repository<NotificationOutboxEntity>,
    @InjectRepository(Quiz) private readonly quizzes: Repository<Quiz>,
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    private readonly queue: NotificationQueueService,
    private readonly config: ConfigService,
  ) {}
  async enqueueResults(
    quizId: string,
    teacherId: string,
  ): Promise<QuizNotificationSummary> {
    const quiz = await this.assertOwner(quizId, teacherId);
    if (
      quiz.resultReleaseMode === QuizResultReleaseMode.HIDDEN ||
      (quiz.resultReleaseMode === QuizResultReleaseMode.AFTER_DUE &&
        (!quiz.dueAt || new Date() < quiz.dueAt))
    )
      throw new ForbiddenException(
        'Kết quả chưa được công bố nên chưa thể gửi email',
      );
    const attempts = await this.attempts.find({
      where: { quizId, status: QuizAttemptStatus.SUBMITTED },
      relations: { user: true },
    });
    const guests = attempts.filter((attempt) => !attempt.userId).length;
    const best = new Map<string, QuizAttempt>();
    for (const attempt of attempts) {
      if (!attempt.userId || !attempt.user?.email) continue;
      const current = best.get(attempt.userId);
      if (!current || compareAttemptsForRanking(attempt, current) < 0)
        best.set(attempt.userId, attempt);
    }
    let queued = 0;
    let alreadyQueued = 0;
    for (const attempt of best.values()) {
      const dedupeKey = `quiz-result:${quizId}:${attempt.userId}:${attempt.id}`;
      const existing = await this.outbox.findOne({ where: { dedupeKey } });
      if (existing) {
        alreadyQueued++;
        continue;
      }
      const row = await this.outbox.save(
        this.outbox.create({
          type: 'quiz_result',
          recipientUserId: attempt.userId,
          recipientEmail: attempt.user!.email!,
          status: NotificationOutboxStatus.PENDING,
          attempts: 0,
          maxAttempts: 5,
          dedupeKey,
          lastError: null,
          availableAt: new Date(),
          sentAt: null,
          payload: {
            studentName: attempt.user!.fullName,
            quizTitle: quiz.title,
            score: Number(attempt.score ?? 0),
            maxScore: Number(attempt.maxScore),
            resultUrl: `${this.config.get<string>('WEB_URL', 'http://localhost:1111')}/attempts/${attempt.id}`,
          },
        }),
      );
      await this.queue.enqueue(row.id).catch(() => undefined);
      queued++;
    }
    return { queued, skippedGuests: guests, alreadyQueued };
  }
  async enqueueAssigned(
    quizId: string,
    teacherId: string,
  ): Promise<QuizNotificationSummary> {
    return this.enqueueAssignedUsers(quizId, teacherId, 'quiz_assigned');
  }

  async enqueueDeadline(
    quizId: string,
    teacherId: string,
  ): Promise<QuizNotificationSummary> {
    return this.enqueueAssignedUsers(quizId, teacherId, 'quiz_deadline');
  }

  private async enqueueAssignedUsers(
    quizId: string,
    teacherId: string,
    type: 'quiz_assigned' | 'quiz_deadline',
  ): Promise<QuizNotificationSummary> {
    const quiz = await this.assertOwner(quizId, teacherId, true);
    const recipients = new Map<
      string,
      { id: string; email: string; fullName: string }
    >();
    for (const assignment of quiz.assignments ?? []) {
      if (assignment.student?.email)
        recipients.set(assignment.student.id, {
          id: assignment.student.id,
          email: assignment.student.email,
          fullName: assignment.student.fullName,
        });
      for (const member of assignment.classroom?.members ?? []) {
        if (member.user?.email)
          recipients.set(member.user.id, {
            id: member.user.id,
            email: member.user.email,
            fullName: member.user.fullName,
          });
      }
    }
    let queued = 0;
    let alreadyQueued = 0;
    const version =
      type === 'quiz_deadline'
        ? (quiz.dueAt?.toISOString() ?? 'no-deadline')
        : quiz.updatedAt.toISOString();
    for (const recipient of recipients.values()) {
      const dedupeKey = `${type}:${quizId}:${recipient.id}:${version}`;
      if (await this.outbox.exists({ where: { dedupeKey } })) {
        alreadyQueued++;
        continue;
      }
      const deadline = quiz.dueAt
        ? new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'Asia/Ho_Chi_Minh',
          }).format(quiz.dueAt)
        : null;
      const assigned = type === 'quiz_assigned';
      const availableAt =
        type === 'quiz_deadline' && quiz.dueAt
          ? new Date(Math.max(Date.now(), quiz.dueAt.getTime() - 86_400_000))
          : new Date();
      const row = await this.outbox.save(
        this.outbox.create({
          type,
          recipientUserId: recipient.id,
          recipientEmail: recipient.email,
          status: NotificationOutboxStatus.PENDING,
          attempts: 0,
          maxAttempts: 5,
          dedupeKey,
          lastError: null,
          availableAt,
          sentAt: null,
          payload: {
            studentName: recipient.fullName,
            quizTitle: quiz.title,
            subject: assigned
              ? `Quiz mới: ${quiz.title} — ZuniBee`
              : `Sắp đến hạn: ${quiz.title} — ZuniBee`,
            message: assigned
              ? `Giáo viên vừa giao cho bạn quiz “${quiz.title}”.${deadline ? ` Hạn hoàn thành: ${deadline}.` : ''}`
              : `Quiz “${quiz.title}” sắp đến hạn${deadline ? ` vào ${deadline}` : ''}. Hãy hoàn thành bài đúng thời gian.`,
            actionLabel: assigned ? 'Mở quiz' : 'Tiếp tục làm bài',
            quizUrl: `${this.config.get<string>('WEB_URL', 'http://localhost:1111')}/q/${quiz.id}`,
          },
        }),
      );
      await this.queue.enqueue(row.id, availableAt).catch(() => undefined);
      queued++;
    }
    return { queued, skippedGuests: 0, alreadyQueued };
  }
  async list(
    quizId: string,
    teacherId: string,
  ): Promise<NotificationOutboxItem[]> {
    await this.assertOwner(quizId, teacherId);
    const rows = await this.outbox
      .createQueryBuilder('outbox')
      .where('outbox.dedupe_key LIKE :prefix', {
        prefix: `quiz-result:${quizId}:%`,
      })
      .orderBy('outbox.created_at', 'DESC')
      .getMany();
    return rows.map((row) => ({
      id: row.id,
      recipientEmail: row.recipientEmail,
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
  private async assertOwner(
    quizId: string,
    teacherId: string,
    withRecipients = false,
  ): Promise<Quiz> {
    const quiz = await this.quizzes.findOne({
      where: { id: quizId },
      relations: withRecipients
        ? {
            assignments: {
              student: true,
              classroom: { members: { user: true } },
            },
          }
        : undefined,
    });
    if (!quiz) throw new NotFoundException('Quiz không tồn tại');
    if (quiz.teacherId !== teacherId)
      throw new ForbiddenException(
        'Bạn không có quyền gửi thông báo cho quiz này',
      );
    return quiz;
  }
}
