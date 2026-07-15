import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { UserRole, UserStatus } from '@zunibee/shared';
import { IsNull, Repository } from 'typeorm';
import { User } from '@/modules/user/entities/user.entity';
import {
  NotificationOutboxEntity,
  NotificationOutboxStatus,
} from './entities/notification-outbox.entity';
import { NotificationQueueService } from './notification-queue.service';

export type EnqueueAiBudgetAlertInput = {
  budgetId: string;
  budgetName: string;
  createdBy: string | null;
  periodStart: Date;
  periodLabel: string;
  scopeLabel: string;
  spentUsd: number;
  limitUsd: number;
  usagePercent: number;
  warningPercent: number;
};

@Injectable()
export class AiBudgetNotificationService {
  private readonly logger = new Logger(AiBudgetNotificationService.name);

  constructor(
    @InjectRepository(NotificationOutboxEntity)
    private readonly outbox: Repository<NotificationOutboxEntity>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly queue: NotificationQueueService,
    private readonly config: ConfigService,
  ) {}

  async enqueue(input: EnqueueAiBudgetAlertInput): Promise<number> {
    const recipients = await this.resolveRecipients(input.createdBy);
    let queued = 0;

    for (const recipient of recipients) {
      const row = this.outbox.create({
        type: 'ai_budget_alert',
        recipientUserId: recipient.id,
        recipientEmail: recipient.email!,
        status: NotificationOutboxStatus.PENDING,
        attempts: 0,
        maxAttempts: 5,
        dedupeKey: `ai-budget:${input.budgetId}:${input.periodStart.toISOString()}:${recipient.id}`,
        lastError: null,
        availableAt: new Date(),
        sentAt: null,
        payload: {
          adminName: recipient.fullName,
          budgetName: input.budgetName,
          periodLabel: input.periodLabel,
          scopeLabel: input.scopeLabel,
          spentUsd: input.spentUsd,
          limitUsd: input.limitUsd,
          usagePercent: input.usagePercent,
          warningPercent: input.warningPercent,
          usageUrl: `${this.config.get<string>('WEB_URL', 'http://localhost:1111')}/admin/ai/usage`,
        },
      });
      const result = await this.outbox
        .createQueryBuilder()
        .insert()
        .into(NotificationOutboxEntity)
        .values({
          type: row.type,
          recipientUserId: row.recipientUserId,
          recipientEmail: row.recipientEmail,
          payload: row.payload as never,
          status: row.status,
          attempts: row.attempts,
          maxAttempts: row.maxAttempts,
          dedupeKey: row.dedupeKey,
          lastError: row.lastError,
          availableAt: row.availableAt,
          sentAt: row.sentAt,
        })
        .orIgnore()
        .returning(['id'])
        .execute();
      const outboxId = result.identifiers[0]?.id as string | undefined;
      if (!outboxId) continue;
      await this.queue.enqueue(outboxId).catch((error: unknown) => {
        this.logger.warn(
          `Không đẩy được cảnh báo ngân sách ${input.budgetId} vào Redis: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
      queued += 1;
    }

    if (!recipients.length)
      this.logger.warn(
        `Ngân sách ${input.budgetId} đã chạm ngưỡng nhưng không có admin nhận email`,
      );
    return queued;
  }

  private async resolveRecipients(createdBy: string | null): Promise<User[]> {
    if (createdBy) {
      const creator = await this.users.findOne({
        where: {
          id: createdBy,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          deletedAt: IsNull(),
        },
      });
      if (creator?.email) return [creator];
    }

    const admins = await this.users.find({
      where: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'ASC' },
    });
    return admins.filter((admin) => Boolean(admin.email));
  }
}
