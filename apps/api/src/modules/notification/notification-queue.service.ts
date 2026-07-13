import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue, Worker } from 'bullmq';
import { LessThanOrEqual, Repository } from 'typeorm';
import { MailService } from '@/modules/mail/mail.service';
import {
  NotificationOutboxEntity,
  NotificationOutboxStatus,
} from './entities/notification-outbox.entity';

const QUEUE_NAME = 'zunibee-notifications';
@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private queue?: Queue<{ outboxId: string }>;
  private worker?: Worker<{ outboxId: string }>;
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(NotificationOutboxEntity)
    private readonly outbox: Repository<NotificationOutboxEntity>,
    private readonly mail: MailService,
  ) {}
  async onModuleInit(): Promise<void> {
    if (
      this.config.get<string>('NODE_ENV') === 'test' ||
      this.config.get<string>('NOTIFICATION_WORKER_ENABLED', 'true') !== 'true'
    )
      return;
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue<{ outboxId: string }>(QUEUE_NAME, { connection });
    this.worker = new Worker<{ outboxId: string }>(
      QUEUE_NAME,
      (job) => this.process(job),
      {
        connection,
        concurrency: 5,
      },
    );
    this.worker.on('error', (error) =>
      this.logger.error(`Notification Worker: ${error.message}`),
    );
    const pending = await this.outbox.find({
      where: {
        status: NotificationOutboxStatus.PENDING,
        availableAt: LessThanOrEqual(new Date()),
      },
      take: 500,
    });
    await Promise.all(pending.map((row) => this.enqueue(row.id)));
  }
  async enqueue(outboxId: string): Promise<void> {
    if (!this.queue) return;
    await this.queue.add(
      'send',
      { outboxId },
      {
        jobId: outboxId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }
  private async process(job: Job<{ outboxId: string }>): Promise<void> {
    const row = await this.outbox.findOne({ where: { id: job.data.outboxId } });
    if (!row || row.status === NotificationOutboxStatus.SENT) return;
    row.status = NotificationOutboxStatus.PROCESSING;
    row.attempts += 1;
    await this.outbox.save(row);
    try {
      if (row.type !== 'quiz_result')
        throw new Error(`Loại thông báo chưa hỗ trợ: ${row.type}`);
      const payload = row.payload as {
        studentName: string;
        quizTitle: string;
        score: number;
        maxScore: number;
        resultUrl: string;
      };
      await this.mail.sendQuizResult({ email: row.recipientEmail, ...payload });
      row.status = NotificationOutboxStatus.SENT;
      row.sentAt = new Date();
      row.lastError = null;
      await this.outbox.save(row);
    } catch (error) {
      row.lastError = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 2000);
      row.status =
        row.attempts >= row.maxAttempts
          ? NotificationOutboxStatus.FAILED
          : NotificationOutboxStatus.PENDING;
      row.availableAt = new Date(
        Date.now() + 5000 * 2 ** Math.max(0, row.attempts - 1),
      );
      await this.outbox.save(row);
      throw error;
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
