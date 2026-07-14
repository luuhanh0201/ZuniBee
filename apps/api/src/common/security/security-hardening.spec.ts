import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { UserRole } from '@zunibee/shared';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { TrustedOriginGuard } from '@/modules/auth/guards/trusted-origin.guard';
import { GoogleOAuthStateGuard } from '@/modules/auth/guards/oauth-state.guard';
import { AiProviderUrlPolicyService } from '@/modules/ai/ai-provider-url-policy.service';
import { AiProviderKind } from '@/modules/ai/entities/ai-provider.entity';
import { QuizAttemptService } from '@/modules/quiz/quiz-attempt.service';
import { QuizAttempt } from '@/modules/quiz/entities/quiz-attempt.entity';
import { QuizAttemptAnswer } from '@/modules/quiz/entities/quiz-attempt-answer.entity';
import { QuizQuestion } from '@/modules/quiz/entities/quiz-question.entity';
import { QuizService } from '@/modules/quiz/quiz.service';
import {
  assertDeclaredFileType,
  verifiedImageMime,
} from '@/modules/upload-file/upload-file-validation.util';

describe('Security hardening', () => {
  it('blocks cookie-issuing auth requests from untrusted origins in production', () => {
    const guard = new TrustedOriginGuard(
      config({ NODE_ENV: 'production', WEB_URL: 'https://zunibee.test' }),
    );
    expect(() =>
      guard.canActivate(
        httpContext({
          path: '/api/v1/auth/refresh',
          headers: { origin: 'https://evil.test' },
        }),
      ),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        httpContext({
          path: '/api/v1/auth/refresh',
          headers: {
            origin: 'https://zunibee.test',
            'x-requested-with': 'XMLHttpRequest',
          },
        }),
      ),
    ).toBe(true);
  });

  it('requires a matching one-time OAuth state cookie', () => {
    const guard = new GoogleOAuthStateGuard(config({ NODE_ENV: 'test' }));
    expect(() =>
      guard.canActivate(
        httpContext({ query: {}, cookies: {} }, { clearCookie: jest.fn() }),
      ),
    ).toThrow('Phiên OAuth không hợp lệ');
    expect(
      guard.canActivate(
        httpContext(
          {
            query: { state: 'matching-state' },
            cookies: {
              'zunibee-oauth-google': 'matching-state',
            },
          },
          { clearCookie: jest.fn() },
        ),
      ),
    ).toBe(true);
  });

  it('blocks private SSRF targets while allowing configured local Ollama', async () => {
    const policy = new AiProviderUrlPolicyService(
      config({ NODE_ENV: 'production' }),
    );
    await expect(
      policy.assertAllowed(
        AiProviderKind.OPENAI_COMPATIBLE,
        'http://api.example.com/v1',
      ),
    ).rejects.toThrow('bắt buộc dùng HTTPS');
    await expect(
      policy.assertAllowed(
        AiProviderKind.OPENAI_COMPATIBLE,
        'https://127.0.0.1/v1',
      ),
    ).rejects.toThrow('mạng nội bộ');
    await expect(
      policy.assertAllowed(AiProviderKind.OLLAMA, 'http://postgres:5432'),
    ).rejects.toThrow('host/port');
    await expect(
      policy.assertAllowed(
        AiProviderKind.OLLAMA,
        'http://host.docker.internal:11434',
      ),
    ).resolves.toBeUndefined();
  });

  it('uses magic bytes instead of trusting the upload MIME header', () => {
    expect(
      verifiedImageMime(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('image/png');
    expect(() =>
      assertDeclaredFileType({
        buffer: Buffer.from('<script>alert(1)</script>'),
        mimetype: 'application/pdf',
        originalname: 'fake.pdf',
      }),
    ).toThrow('không khớp định dạng');
  });

  it('blocks guest attempt access without the matching secret token', async () => {
    const guestToken = 'guest-secret-token-1234';
    const attempt = {
      id: '00000000-0000-4000-8000-000000000010',
      userId: null,
      guestToken: createHash('sha256').update(guestToken).digest('hex'),
      status: 'in_progress',
      startedAt: new Date(),
      submittedAt: null,
      expiresAt: null,
      score: null,
      maxScore: '10',
      attemptNumber: 1,
      answers: [],
      quizId: '00000000-0000-4000-8000-000000000020',
      quiz: {
        title: 'Quiz bảo mật',
        dueAt: null,
        teacherId: '00000000-0000-4000-8000-000000000030',
        questions: [],
      },
    } as unknown as QuizAttempt;
    const attempts = { findOne: jest.fn().mockResolvedValue(attempt) };
    const service = new QuizAttemptService(
      attempts as unknown as Repository<QuizAttempt>,
      {} as Repository<QuizAttemptAnswer>,
      {} as Repository<QuizQuestion>,
      {} as QuizService,
    );

    await expect(service.get(attempt.id, null)).rejects.toThrow(
      'Mã truy cập lượt làm không hợp lệ',
    );
    await expect(
      service.get(attempt.id, null, 'wrong-token-123456'),
    ).rejects.toThrow('Mã truy cập lượt làm không hợp lệ');
    await expect(
      service.get(attempt.id, null, guestToken),
    ).resolves.toMatchObject({
      id: attempt.id,
    });
    await expect(
      service.get(attempt.id, {
        id: '00000000-0000-4000-8000-000000000040',
        email: 'student@example.com',
        role: UserRole.STUDENT,
      }),
    ).rejects.toThrow('Mã truy cập lượt làm không hợp lệ');
  });

  it('blocks after exceeding the fallback rate limit', async () => {
    const storage = new RedisThrottlerStorage(config({ NODE_ENV: 'test' }));
    await storage.increment('key', 60_000, 2, 60_000, 'default');
    await storage.increment('key', 60_000, 2, 60_000, 'default');
    await expect(
      storage.increment('key', 60_000, 2, 60_000, 'default'),
    ).resolves.toMatchObject({ isBlocked: true });
    await storage.onModuleDestroy();
  });
});

function config(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
    getOrThrow: (key: string) => {
      if (values[key] === undefined) throw new Error(`Missing ${key}`);
      return values[key];
    },
  } as ConfigService;
}

function httpContext(
  request: Record<string, unknown>,
  response: Record<string, unknown> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;
}
