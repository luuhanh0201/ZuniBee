import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { isNonRetryableAiError } from './ai-error';
import { boundedConcurrency } from './bounded-concurrency';

const QUEUE_NAME = 'zunibee-ai-generation';
export const AI_GENERATION_PROCESSOR = Symbol('AI_GENERATION_PROCESSOR');

export type AiGenerationProcessor = {
  process(jobId: string): Promise<void>;
  markRetrying(
    jobId: string,
    error: unknown,
    attemptCount: number,
  ): Promise<void>;
  markFailed(jobId: string, error: unknown): Promise<void>;
};

@Injectable()
export class AiGenerationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiGenerationQueueService.name);
  private queue?: Queue<{ jobId: string }>;
  private worker?: Worker<{ jobId: string }>;

  constructor(
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue<{ jobId: string }>(QUEUE_NAME, { connection });
    if (
      this.config.get<string>('AI_GENERATION_WORKER_ENABLED', 'true') !== 'true'
    )
      return;

    this.worker = new Worker<{ jobId: string }>(
      QUEUE_NAME,
      async (job) => {
        try {
          await this.processor().process(job.data.jobId);
        } catch (error) {
          // Lỗi cố định (HTTP 4xx, schema/validation, dữ liệu đầu vào sai)
          // không thể tự phục hồi — UnrecoverableError dừng retry ngay,
          // không gọi provider thêm lần nào với cùng payload.
          if (isNonRetryableAiError(error))
            throw new UnrecoverableError(safeError(error));
          throw error;
        }
      },
      {
        connection,
        concurrency: boundedConcurrency(
          this.config.get<string | number>('AI_GENERATION_WORKER_CONCURRENCY'),
          1,
          4,
        ),
      },
    );
    this.worker.on('failed', (job, error) => {
      if (!job) return;
      const attempts = Number(job.opts.attempts ?? 1);
      const finalAttempt =
        job.attemptsMade >= attempts || error instanceof UnrecoverableError;
      const update = finalAttempt
        ? this.processor().markFailed(job.data.jobId, error)
        : this.processor().markRetrying(
            job.data.jobId,
            error,
            job.attemptsMade,
          );
      void update.catch((updateError: unknown) =>
        this.logger.error(
          `Không thể cập nhật AI job ${job.data.jobId}: ${safeError(updateError)}`,
        ),
      );
    });
    this.worker.on('error', (error) =>
      this.logger.error(`AI generation worker: ${error.message}`),
    );
  }

  async enqueue(jobId: string): Promise<void> {
    if (!this.queue) throw new Error('AI generation queue chưa sẵn sàng');
    await this.queue.add(
      'generate',
      { jobId },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private processor(): AiGenerationProcessor {
    return this.moduleRef.get<AiGenerationProcessor>(AI_GENERATION_PROCESSOR, {
      strict: false,
    });
  }
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}
