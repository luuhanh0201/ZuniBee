import { NotificationQueueService } from './notification-queue.service';
import { NotificationOutboxStatus } from './entities/notification-outbox.entity';

describe('NotificationQueueService', () => {
  it('sends an AI budget alert and marks the outbox row as sent', async () => {
    const row = {
      id: 'outbox-1',
      type: 'ai_budget_alert',
      recipientEmail: 'admin@gmail.com',
      payload: {
        adminName: 'Admin Bee',
        budgetName: 'Ngân sách AI tháng',
        periodLabel: 'Tháng 07/2026',
        scopeLabel: 'Toàn hệ thống',
        spentUsd: 8,
        limitUsd: 10,
        usagePercent: 80,
        warningPercent: 80,
        usageUrl: 'https://zunibee.online/admin/ai/usage',
      },
      status: NotificationOutboxStatus.PENDING,
      attempts: 0,
      maxAttempts: 5,
      lastError: null,
      availableAt: new Date(),
      sentAt: null,
    };
    const outbox = {
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const mail = {
      sendAiBudgetAlert: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NotificationQueueService(
      { get: jest.fn() } as never,
      outbox as never,
      mail as never,
    );

    await (
      service as unknown as {
        process(job: { data: { outboxId: string } }): Promise<void>;
      }
    ).process({ data: { outboxId: row.id } });

    expect(mail.sendAiBudgetAlert).toHaveBeenCalledWith({
      email: 'admin@gmail.com',
      ...row.payload,
    });
    expect(row.status).toBe(NotificationOutboxStatus.SENT);
    expect(row.attempts).toBe(1);
    expect(row.sentAt).toBeInstanceOf(Date);
  });
});
