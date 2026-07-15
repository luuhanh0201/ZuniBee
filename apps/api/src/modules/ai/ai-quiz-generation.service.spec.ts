import { AiQuizGenerationService } from './ai-quiz-generation.service';
import { generationLanguageInstruction } from './prompts/quiz-generation.prompt';
import {
  AiGenerationJobStage,
  AiGenerationJobStatus,
} from './entities/ai-generation-job.entity';
import { AiProviderKind } from './entities/ai-provider.entity';
import type { AiMaterialVisionContext } from './ai-material-source.service';

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
      update: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Mock AI',
      kind: AiProviderKind.OPENAI_COMPATIBLE,
      baseCreditCost: 1,
      creditCostPer1kTokens: 1,
    };
    const providers = { resolveQuiz: jest.fn().mockResolvedValue(provider) };
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

describe('AiQuizGenerationService provider routing', () => {
  it('uses the vision provider for image fallback and the quiz provider for synthesis', async () => {
    const quizProvider = {
      id: '00000000-0000-4000-8000-000000000010',
      name: 'Quiz AI',
      kind: AiProviderKind.OPENAI_COMPATIBLE,
      baseCreditCost: 1,
      creditCostPer1kTokens: 1,
    };
    const visionProvider = {
      id: '00000000-0000-4000-8000-000000000020',
      name: 'Vision AI',
      kind: AiProviderKind.OPENAI_COMPATIBLE,
      baseCreditCost: 1,
      creditCostPer1kTokens: 1,
    };
    const providers = {
      resolveQuiz: jest.fn().mockResolvedValue(quizProvider),
      resolveVision: jest.fn().mockResolvedValue(visionProvider),
    };
    const jobs = {
      create: (value: Record<string, unknown>) => value,
      save: jest.fn((value: Record<string, unknown>) =>
        Promise.resolve({
          id: '00000000-0000-4000-8000-000000000001',
          createdAt: new Date('2026-07-15T00:00:00.000Z'),
          updatedAt: new Date('2026-07-15T00:00:00.000Z'),
          ...value,
        }),
      ),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const credits = {
      reserve: jest.fn().mockResolvedValue(undefined),
      settle: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({
        userId: 'teacher-id',
        balance: 100,
        reserved: 0,
        available: 100,
        updatedAt: new Date().toISOString(),
      }),
    };
    const materialSource = {
      extract: jest.fn(
        async (
          _file: Express.Multer.File,
          context: AiMaterialVisionContext,
        ) => {
          if (!context.onProgress) throw new Error('Missing progress callback');
          await context.onProgress({ totalPages: 19, processedPages: 5 });
          return {
            text: 'Nội dung đã trích xuất',
            textLayerPages: 0,
            localOcrPages: 1,
            aiVisionPages: 1,
            visionInputTokens: 100,
            visionOutputTokens: 20,
          };
        },
      ),
    };
    const client = {
      completeJson: jest.fn().mockResolvedValue({
        value: {
          questions: [
            {
              type: 'single_choice',
              content: 'Câu hỏi?',
              options: [
                { content: 'Đúng', isCorrect: true },
                { content: 'Sai', isCorrect: false },
              ],
            },
          ],
        },
        inputTokens: 200,
        outputTokens: 100,
      }),
    };
    const quiz = {
      id: 'quiz-id',
      title: 'Quiz AI',
      description: null,
      questions: [],
    };
    const quizzes = {
      create: jest.fn().mockResolvedValue(quiz),
      addQuestion: jest.fn().mockResolvedValue(quiz),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AiQuizGenerationService(
      jobs as never,
      providers as never,
      credits as never,
      client as never,
      materialSource as never,
      quizzes as never,
    );
    const file = {
      originalname: 'source.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    } as Express.Multer.File;

    await service.generate(
      'teacher-id',
      {
        title: 'Quiz AI',
        topic: 'Tài liệu',
        questionCount: 1,
        sourceType: 'upload',
      },
      file,
    );

    expect(providers.resolveQuiz).toHaveBeenCalledTimes(1);
    expect(providers.resolveVision).toHaveBeenCalledTimes(1);
    expect(materialSource.extract).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        provider: visionProvider,
        referenceId: '00000000-0000-4000-8000-000000000001',
        userId: 'teacher-id',
      }),
    );
    expect(typeof materialSource.extract.mock.calls[0]?.[1].onProgress).toBe(
      'function',
    );
    expect(jobs.update).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      expect.objectContaining({
        stage: AiGenerationJobStage.READING_DOCUMENT,
        documentTotalPages: 19,
        documentProcessedPages: 5,
      }),
    );
    expect(client.completeJson).toHaveBeenCalledWith(
      quizProvider,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ source: 'quiz_generation' }),
      expect.any(Object),
    );
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
