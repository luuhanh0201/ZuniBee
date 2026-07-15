import { AiQuizGenerationService } from './ai-quiz-generation.service';
import { generationLanguageInstruction } from './prompts/quiz-generation.prompt';
import { AiGenerationJobStatus } from './entities/ai-generation-job.entity';
import { AiProviderKind } from './entities/ai-provider.entity';

describe('AiQuizGenerationService credit safety', () => {
  function setup(reserveError?: Error, providerError?: Error) {
    const saved: Array<Record<string, unknown>> = [];
    const jobs = {
      create: (value: Record<string, unknown>) => value,
      save: jest.fn((value: Record<string, unknown>) => {
        const row = {
          id: '00000000-0000-4000-8000-000000000001',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...value,
        };
        saved.push({ ...row });
        return Promise.resolve(row);
      }),
    };
    const provider = {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Mock AI',
      kind: AiProviderKind.OPENAI_COMPATIBLE,
      baseCreditCost: 1,
      creditCostPer1kTokens: 1,
    };
    const providers = { resolve: jest.fn().mockResolvedValue(provider) };
    const credits = {
      reserve: reserveError
        ? jest.fn().mockRejectedValue(reserveError)
        : jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      settle: jest.fn(),
      get: jest.fn(),
    };
    const client = {
      completeJson: providerError
        ? jest.fn().mockRejectedValue(providerError)
        : jest.fn(),
    };
    const service = new AiQuizGenerationService(
      jobs as never,
      providers as never,
      credits as never,
      client as never,
      {} as never,
      { create: jest.fn(), remove: jest.fn() } as never,
    );
    return { service, jobs, credits, client, saved };
  }

  const input = {
    title: 'Quiz AI',
    topic: 'Toán',
    questionCount: 5,
    sourceType: 'prompt' as const,
  };

  it('marks the job failed before calling a provider when reserve fails', async () => {
    const context = setup(new Error('insufficient'));
    await expect(context.service.generate('teacher-id', input)).rejects.toThrow(
      'insufficient',
    );
    expect(context.client.completeJson).not.toHaveBeenCalled();
    expect(context.saved.at(-1)?.status).toBe(AiGenerationJobStatus.FAILED);
  });

  it('releases the full reservation when the provider fails', async () => {
    const context = setup(undefined, new Error('provider down'));
    await expect(context.service.generate('teacher-id', input)).rejects.toThrow(
      'provider down',
    );
    expect(context.credits.release).toHaveBeenCalledWith(
      'teacher-id',
      'quiz_generation',
      '00000000-0000-4000-8000-000000000001',
      expect.any(Number),
    );
    expect(context.saved.at(-1)?.status).toBe(AiGenerationJobStatus.FAILED);
  });
});

describe('generationLanguageInstruction', () => {
  it('giữ nguyên ngôn ngữ tài liệu khi chọn tự động', () => {
    expect(generationLanguageInstruction('auto', true)).toContain(
      'ngôn ngữ chính của tài liệu nguồn',
    );
    expect(generationLanguageInstruction('auto', true)).toContain('không dịch');
  });

  it('ánh xạ mã ngôn ngữ thành chỉ dẫn rõ ràng', () => {
    expect(generationLanguageInstruction('vi', true)).toBe('tiếng Việt (vi)');
    expect(generationLanguageInstruction('en', true)).toBe('English (en)');
  });
});
