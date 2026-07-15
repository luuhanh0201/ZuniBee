import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { User } from '@/modules/user/entities/user.entity';
import { AiBudgetNotificationService } from './ai-budget-notification.service';
import type { NotificationOutboxEntity } from './entities/notification-outbox.entity';
import type { NotificationQueueService } from './notification-queue.service';

describe('AiBudgetNotificationService', () => {
  function setup(insertedId: string | null = 'outbox-1') {
    type InsertedOutbox = {
      recipientUserId: string;
      recipientEmail: string;
      dedupeKey: string;
      payload: { usageUrl: string; warningPercent: number };
    };
    let insertedValue: InsertedOutbox | undefined;
    const execute = jest.fn().mockResolvedValue({
      identifiers: insertedId ? [{ id: insertedId }] : [],
    });
    const values = jest.fn(function (
      this: Record<string, jest.Mock>,
      value: unknown,
    ) {
      insertedValue = value as InsertedOutbox;
      return this;
    });
    const builder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values,
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute,
    };
    const outbox = {
      create: (value: unknown) => value,
      createQueryBuilder: jest.fn(() => builder),
    } as unknown as Repository<NotificationOutboxEntity>;
    const admin = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@gmail.com',
      fullName: 'Admin Bee',
    } as User;
    const users = {
      findOne: jest.fn().mockResolvedValue(admin),
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<User>;
    const queueEnqueue = jest.fn().mockResolvedValue(undefined);
    const queue = {
      enqueue: queueEnqueue,
    } as unknown as NotificationQueueService;
    const config = {
      get: jest.fn((_key: string, fallback: string) =>
        _key === 'WEB_URL' ? 'https://zunibee.online' : fallback,
      ),
    } as unknown as ConfigService;
    return {
      service: new AiBudgetNotificationService(outbox, users, queue, config),
      admin,
      insertedValue: () => insertedValue,
      queueEnqueue,
    };
  }

  const input = {
    budgetId: '00000000-0000-4000-8000-000000000002',
    budgetName: 'Ngân sách AI tháng',
    createdBy: '00000000-0000-4000-8000-000000000001',
    periodStart: new Date('2026-07-01T00:00:00.000Z'),
    periodLabel: 'Tháng 07/2026',
    scopeLabel: 'Toàn hệ thống',
    spentUsd: 8,
    limitUsd: 10,
    usagePercent: 80,
    warningPercent: 80,
  };

  it('queues one email for the admin who created the budget', async () => {
    const context = setup();

    await expect(context.service.enqueue(input)).resolves.toBe(1);

    const inserted = context.insertedValue();
    expect(inserted).toMatchObject({
      recipientUserId: context.admin.id,
      recipientEmail: 'admin@gmail.com',
      dedupeKey: `ai-budget:${input.budgetId}:2026-07-01T00:00:00.000Z:${context.admin.id}`,
      payload: {
        usageUrl: 'https://zunibee.online/admin/ai/usage',
        warningPercent: 80,
      },
    });
    expect(context.queueEnqueue).toHaveBeenCalledWith('outbox-1');
  });

  it('does not enqueue Redis again when the database dedupe key exists', async () => {
    const context = setup(null);

    await expect(context.service.enqueue(input)).resolves.toBe(0);

    expect(context.queueEnqueue).not.toHaveBeenCalled();
  });
});
