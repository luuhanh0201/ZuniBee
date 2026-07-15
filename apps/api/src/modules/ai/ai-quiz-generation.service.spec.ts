import {
  AiQuizGenerationService,
  buildCognitiveDistribution,
  buildDocumentChunks,
  isLowValueMetadataQuestion,
  selectQuestions,
} from './ai-quiz-generation.service';
import { generationLanguageInstruction } from './prompts/quiz-generation.prompt';
import {
  AiGenerationJobStage,
  AiGenerationJobStatus,
} from './entities/ai-generation-job.entity';
import { AiProviderKind } from './entities/ai-provider.entity';
import type { AiMaterialVisionContext } from './ai-material-source.service';

const JOB_ID = '00000000-0000-4000-8000-000000000001';
const QUIZ_PROVIDER_ID = '00000000-0000-4000-8000-000000000010';
const VISION_PROVIDER_ID = '00000000-0000-4000-8000-000000000020';

function acceptedService(options?: {
  reserveError?: Error;
  enqueueError?: Error;
}) {
  const rows = new Map<string, Record<string, unknown>>();
  const jobs = {
    create: (value: Record<string, unknown>) => value,
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((value: Record<string, unknown>) => {
      const row = {
        id: JOB_ID,
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
        updatedAt: new Date('2026-07-15T00:00:00.000Z'),
        ...value,
      };
      rows.set(JOB_ID, row);
      return Promise.resolve(row);
    }),
  };
  const provider = {
    id: QUIZ_PROVIDER_ID,
    name: 'Quiz AI',
    kind: AiProviderKind.OPENAI_COMPATIBLE,
    baseCreditCost: 1,
    creditCostPer1kTokens: 1,
  };
  const providers = {
    resolveQuiz: jest.fn().mockResolvedValue(provider),
    resolveVision: jest.fn(),
  };
  const credits = {
    reserve: options?.reserveError
      ? jest.fn().mockRejectedValue(options.reserveError)
      : jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue({
      userId: 'teacher-id',
      balance: 100,
      reserved: 1,
      available: 99,
      updatedAt: new Date().toISOString(),
    }),
  };
  const queue = {
    enqueue: options?.enqueueError
      ? jest.fn().mockRejectedValue(options.enqueueError)
      : jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    store: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AiQuizGenerationService(
    jobs as never,
    {} as never,
    {} as never,
    providers as never,
    credits as never,
    {} as never,
    {} as never,
    storage as never,
    queue as never,
    {} as never,
  );
  return { service, jobs, credits, queue };
}

describe('AiQuizGenerationService async submission', () => {
  const input = {
    title: 'Quiz AI',
    topic: 'Toán',
    questionCount: 5,
    sourceType: 'prompt' as const,
  };

  it('marks the job failed before enqueue when reserve fails', async () => {
    const context = acceptedService({
      reserveError: new Error('insufficient'),
    });
    await expect(context.service.generate('teacher-id', input)).rejects.toThrow(
      'insufficient',
    );
    expect(context.queue.enqueue).not.toHaveBeenCalled();
    expect(context.jobs.save.mock.calls.at(-1)?.[0].status).toBe(
      AiGenerationJobStatus.FAILED,
    );
  });

  it('returns a queued job without waiting for the AI provider', async () => {
    const context = acceptedService();
    const response = await context.service.generate('teacher-id', input);

    expect(context.queue.enqueue).toHaveBeenCalledWith(JOB_ID);
    expect(response.job.status).toBe(AiGenerationJobStatus.PENDING);
    expect(response.job.stage).toBe(AiGenerationJobStage.QUEUED);
  });

  it('releases the reservation when enqueue fails', async () => {
    const context = acceptedService({ enqueueError: new Error('redis down') });
    await expect(context.service.generate('teacher-id', input)).rejects.toThrow(
      'redis down',
    );
    expect(context.credits.release).toHaveBeenCalledWith(
      'teacher-id',
      'quiz_generation',
      JOB_ID,
      expect.any(Number),
    );
  });
});

describe('AiQuizGenerationService worker routing and checkpoints', () => {
  it('resumes extracted pages and uses vision/quiz providers for their own stages', async () => {
    const quizProvider = {
      id: QUIZ_PROVIDER_ID,
      name: 'Quiz AI',
      kind: AiProviderKind.OPENAI_COMPATIBLE,
      baseCreditCost: 1,
      creditCostPer1kTokens: 1,
    };
    const visionProvider = {
      id: VISION_PROVIDER_ID,
      name: 'Vision AI',
      kind: AiProviderKind.OPENAI_COMPATIBLE,
    };
    const job = {
      id: JOB_ID,
      teacherId: 'teacher-id',
      providerId: QUIZ_PROVIDER_ID,
      visionProviderId: VISION_PROVIDER_ID,
      quizId: null,
      status: AiGenerationJobStatus.PENDING,
      stage: AiGenerationJobStage.QUEUED,
      documentTotalPages: null,
      documentProcessedPages: 0,
      generationTotalChunks: null,
      generationProcessedChunks: 0,
      sourceStorageKey: `${JOB_ID}/source.pdf`,
      sourceOriginalName: 'source.pdf',
      sourceMimeType: 'application/pdf',
      sourceSize: 1024,
      attemptCount: 0,
      requestPayload: {
        title: 'Quiz AI',
        topic: 'Tài liệu',
        questionCount: 1,
        sourceType: 'upload',
      },
      reservedCredits: 10,
      chargedCredits: 0,
      inputTokens: 0,
      outputTokens: 0,
      errorMessage: null,
      completedAt: null,
      createdAt: new Date('2026-07-15T00:00:00.000Z'),
      updatedAt: new Date('2026-07-15T00:00:00.000Z'),
    };
    const jobs = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(job)),
      save: jest.fn((value: Record<string, unknown>) =>
        Promise.resolve(Object.assign(job, value)),
      ),
      update: jest.fn((_id: string, value: Record<string, unknown>) =>
        Promise.resolve(Object.assign(job, value)),
      ),
    };
    const pageRows: unknown[] = [];
    const pages = {
      find: jest.fn().mockResolvedValue([]),
      create: (value: unknown) => value,
      save: jest.fn((value: unknown) => {
        pageRows.push(value);
        return Promise.resolve(value);
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    let chunkRows: Array<Record<string, unknown>> = [];
    const chunks = {
      find: jest.fn(() => Promise.resolve(chunkRows)),
      create: (value: Record<string, unknown>) => value,
      save: jest.fn(
        (value: Record<string, unknown> | Array<Record<string, unknown>>) => {
          if (Array.isArray(value)) {
            chunkRows = value;
            return Promise.resolve(value);
          }
          return Promise.resolve(value);
        },
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const providers = {
      resolve: jest.fn((id: string) =>
        Promise.resolve(
          id === QUIZ_PROVIDER_ID ? quizProvider : visionProvider,
        ),
      ),
      resolveVision: jest.fn().mockResolvedValue(visionProvider),
    };
    const credits = {
      settle: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const materialSource = {
      extract: jest.fn(
        async (
          _file: Express.Multer.File,
          context: AiMaterialVisionContext,
        ) => {
          const page = {
            pageNumber: 1,
            text: 'Nội dung tài liệu '.repeat(80),
            method: 'ai_vision' as const,
            confidence: null,
            visionInputTokens: 100,
            visionOutputTokens: 20,
          };
          await context.onPageExtracted?.(page);
          await context.onProgress?.({ totalPages: 1, processedPages: 1 });
          return {
            text: page.text,
            pages: [page],
            textLayerPages: 0,
            localOcrPages: 0,
            aiVisionPages: 1,
            visionInputTokens: 100,
            visionOutputTokens: 20,
          };
        },
      ),
    };
    let completionCall = 0;
    const qualityQuestion = (index: number) => ({
      type: 'single_choice',
      content: `Câu hỏi trọng tâm ${index}?`,
      explanation:
        'Đáp án A đúng vì phản ánh nội dung cốt lõi; các phương án còn lại không phù hợp.',
      options: [
        { content: `Đáp án A${index}`, isCorrect: true },
        { content: `Đáp án B${index}`, isCorrect: false },
        { content: `Đáp án C${index}`, isCorrect: false },
        { content: `Đáp án D${index}`, isCorrect: false },
      ],
      objectiveId: 'O1',
      cognitiveLevel: 'understand',
      category: 'core_concept',
      sourcePages: [1],
      sourceEvidence: '',
    });
    const client = {
      completeJson: jest.fn().mockImplementation(() => {
        completionCall += 1;
        const values: unknown[] = [
          {
            chunkIndex: 0,
            sectionType: 'core_content',
            relevanceScore: 95,
            summary: 'Kiến thức trọng tâm của tài liệu',
            keyPoints: [
              {
                title: 'Nội dung trọng tâm',
                description: 'Hiểu nội dung chính trong tài liệu',
                importance: 5,
                cognitiveLevels: ['understand', 'apply'],
                evidence: 'Nội dung tài liệu',
                sourcePages: [1],
              },
            ],
            excludedReason: '',
          },
          {
            documentKind: 'general_subject',
            language: 'vi',
            overview: 'Tài liệu kiểm tra kiến thức trọng tâm',
            targetAudience: 'Người học phổ thông',
            objectives: [
              {
                id: 'O1',
                title: 'Nội dung trọng tâm',
                description: 'Hiểu và vận dụng nội dung tài liệu',
                weight: 100,
                sourceChunkIndexes: [0],
                sourcePages: [1],
                preferredCategories: ['core_concept', 'application'],
              },
            ],
            excludedContent: ['Thông tin hành chính'],
            readingEvidenceRequired: false,
            grammarRuleExplanationRequired: false,
          },
          {
            questions: [
              qualityQuestion(1),
              qualityQuestion(2),
              qualityQuestion(3),
            ],
          },
          { questions: [qualityQuestion(1)] },
        ];
        return Promise.resolve({
          value: values[completionCall - 1],
          inputTokens: 200,
          outputTokens: 100,
        });
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
    const storage = {
      read: jest.fn().mockResolvedValue(Buffer.from('%PDF-source')),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AiQuizGenerationService(
      jobs as never,
      pages as never,
      chunks as never,
      providers as never,
      credits as never,
      client as never,
      materialSource as never,
      storage as never,
      {} as never,
      quizzes as never,
    );

    await service.process(JOB_ID);

    expect(providers.resolve).toHaveBeenCalledWith(QUIZ_PROVIDER_ID);
    expect(materialSource.extract).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ provider: visionProvider }),
    );
    expect(pageRows).toHaveLength(1);
    expect(client.completeJson).toHaveBeenCalledWith(
      quizProvider,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ source: 'quiz_generation' }),
      expect.any(Object),
    );
    expect(job.status).toBe(AiGenerationJobStatus.SUCCEEDED);
    expect(job.inputTokens).toBe(900);
    expect(job.outputTokens).toBe(420);
  });
});

describe('large document chunking', () => {
  it('spreads a 200-page document across bounded chunks', () => {
    const chunks = buildDocumentChunks(
      Array.from({ length: 200 }, (_, index) => ({
        pageNumber: index + 1,
        text: `Trang ${index + 1} ${'kiến thức '.repeat(120)}`,
        method: 'text_layer' as const,
        confidence: null,
        visionInputTokens: 0,
        visionOutputTokens: 0,
      })),
      20,
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(40);
    expect(chunks[0]?.startPage).toBe(1);
    expect(chunks.at(-1)?.endPage).toBe(200);
  });

  it('allocates the requested 20/50/30 cognitive mix exactly', () => {
    expect(buildCognitiveDistribution(20)).toEqual({
      remember: 4,
      understand: 10,
      apply: 6,
    });
    expect(buildCognitiveDistribution(1)).toEqual({
      remember: 0,
      understand: 1,
      apply: 0,
    });
  });

  it('rejects the low-value publication questions observed in the latest quiz', () => {
    expect(
      isLowValueMetadataQuestion("Who is the author of 'A Day with Baby'?"),
    ).toBe(true);
    expect(isLowValueMetadataQuestion('Where was the book published?')).toBe(
      true,
    );
    expect(
      isLowValueMetadataQuestion(
        'Which illustrator provided the illustrations?',
      ),
    ).toBe(true);
    expect(
      isLowValueMetadataQuestion('What body parts are washed in the story?'),
    ).toBe(false);
  });

  it('selects candidates round-robin and removes duplicate questions', () => {
    const question = (content: string) => ({
      type: 'single_choice' as const,
      content,
      explanation: 'Giải thích',
      options: [
        { content: 'Đúng', isCorrect: true },
        { content: 'Sai', isCorrect: false },
      ],
    });
    expect(
      selectQuestions(
        [
          [question('Câu 1'), question('Câu trùng')],
          [question('Câu 2'), question('Câu trùng')],
        ],
        3,
      ).map((row) => row.content),
    ).toEqual(['Câu 1', 'Câu 2', 'Câu trùng']);
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
