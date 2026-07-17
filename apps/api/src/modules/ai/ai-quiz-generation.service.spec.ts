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
import { AiGenerationChunkStatus } from './entities/ai-generation-chunk.entity';
import type {
  QualityQuestion,
  QuizBlueprint,
  QuizChunkAnalysis,
} from './prompts/quiz-quality.prompt';

const JOB_ID = '00000000-0000-4000-8000-000000000001';
const QUIZ_PROVIDER_ID = '00000000-0000-4000-8000-000000000010';
const VISION_PROVIDER_ID = '00000000-0000-4000-8000-000000000020';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function nextTurn(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

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
    resolveVision: jest.fn().mockResolvedValue(provider),
    resolveAnalysis: jest.fn().mockResolvedValue(provider),
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
    store: jest.fn().mockResolvedValue(`${JOB_ID}/source.txt`),
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

  it('stores a SHA-256 fingerprint for exact source-file resume matching', async () => {
    const context = acceptedService();
    const response = await context.service.generate(
      'teacher-id',
      { ...input, sourceType: 'upload' },
      {
        originalname: 'source.txt',
        mimetype: 'text/plain',
        size: 3,
        buffer: Buffer.from('abc'),
      } as Express.Multer.File,
    );

    expect(response.job.sourceFileSha256).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
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

describe('AiQuizGenerationService pause and resume', () => {
  function context(status: AiGenerationJobStatus) {
    const job = {
      id: JOB_ID,
      teacherId: 'teacher-id',
      providerId: QUIZ_PROVIDER_ID,
      visionProviderId: VISION_PROVIDER_ID,
      analysisProviderId: null,
      quizId: null,
      status,
      stage: AiGenerationJobStage.ANALYZING_DOCUMENT,
      documentTotalPages: 8,
      documentProcessedPages: 5,
      generationTotalChunks: 4,
      generationProcessedChunks: 2,
      sourceStorageKey: `${JOB_ID}/source.pdf`,
      sourceOriginalName: 'source.pdf',
      sourceMimeType: 'application/pdf',
      sourceSize: 1234,
      attemptCount: 1,
      quizBlueprint: null,
      requestPayload: {
        title: 'Quiz đang chạy',
        topic: 'Tài liệu',
        questionCount: 5,
        sourceType: 'upload',
      },
      reservedCredits: 10,
      chargedCredits: 0,
      inputTokens: 0,
      outputTokens: 0,
      errorMessage: null,
      errorDetails: null,
      extractionReport: null,
      completedAt: null,
      createdAt: new Date('2026-07-17T00:00:00.000Z'),
      updatedAt: new Date('2026-07-17T00:00:00.000Z'),
    };
    const jobs = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(job)),
      update: jest.fn((_criteria: unknown, values: Record<string, unknown>) => {
        Object.assign(job, values);
        return Promise.resolve({ affected: 1 });
      }),
    };
    const pages = { delete: jest.fn().mockResolvedValue(undefined) };
    const chunks = { delete: jest.fn().mockResolvedValue(undefined) };
    const providers = {
      resolve: jest.fn().mockResolvedValue({
        id: QUIZ_PROVIDER_ID,
        name: 'Quiz AI',
      }),
    };
    const credits = {
      release: jest.fn().mockResolvedValue(undefined),
    };
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new AiQuizGenerationService(
      jobs as never,
      pages as never,
      chunks as never,
      providers as never,
      credits as never,
      {} as never,
      {} as never,
      storage as never,
      queue as never,
      {} as never,
    );
    return { service, job, jobs, pages, chunks, credits, storage, queue };
  }

  it('requests a cooperative pause without releasing source or credits', async () => {
    const value = context(AiGenerationJobStatus.RUNNING);

    const response = await value.service.pause(JOB_ID, 'teacher-id');

    expect(response.status).toBe(AiGenerationJobStatus.PAUSE_REQUESTED);
    expect(value.credits.release).not.toHaveBeenCalled();
    expect(value.storage.delete).not.toHaveBeenCalled();
  });

  it('turns a queued pause request into a stable paused checkpoint', async () => {
    const value = context(AiGenerationJobStatus.PAUSE_REQUESTED);

    await value.service.process(JOB_ID);

    expect(value.job.status).toBe(AiGenerationJobStatus.PAUSED);
    expect(value.queue.enqueue).not.toHaveBeenCalled();
  });

  it('resumes the same job and keeps its page/chunk progress', async () => {
    const value = context(AiGenerationJobStatus.PAUSED);

    const response = await value.service.resume(JOB_ID, 'teacher-id');

    expect(response.status).toBe(AiGenerationJobStatus.PENDING);
    expect(response.documentProcessedPages).toBe(5);
    expect(response.generationProcessedChunks).toBe(2);
    expect(value.queue.enqueue).toHaveBeenCalledWith(JOB_ID);
    expect(value.storage.delete).not.toHaveBeenCalled();
  });

  it('releases reservation and artifacts before replacing a paused file', async () => {
    const value = context(AiGenerationJobStatus.PAUSED);

    const response = await value.service.cancel(JOB_ID, 'teacher-id');

    expect(response.status).toBe(AiGenerationJobStatus.CANCELLED);
    expect(value.credits.release).toHaveBeenCalledWith(
      'teacher-id',
      'quiz_generation',
      JOB_ID,
      10,
    );
    expect(value.storage.delete).toHaveBeenCalledWith(`${JOB_ID}/source.pdf`);
    expect(value.pages.delete).toHaveBeenCalledWith({ jobId: JOB_ID });
    expect(value.chunks.delete).toHaveBeenCalledWith({ jobId: JOB_ID });
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

describe('AiQuizGenerationService bounded chunk concurrency', () => {
  const provider = {
    id: QUIZ_PROVIDER_ID,
    name: 'Quiz AI',
    kind: AiProviderKind.OPENAI_COMPATIBLE,
  };
  const dto = {
    title: 'Quiz song song',
    topic: 'Kiến thức trọng tâm',
    questionCount: 6,
    sourceType: 'upload' as const,
    questionTypes: ['single_choice' as const],
  };

  function analysis(index: number): QuizChunkAnalysis {
    return {
      chunkIndex: index,
      sectionType: 'core_content',
      relevanceScore: 90,
      summary: `Tóm tắt phần ${index}`,
      keyPoints: [
        {
          title: `Kiến thức ${index}`,
          description: `Mô tả kiến thức phần ${index}`,
          importance: 5,
          cognitiveLevels: ['understand'],
          evidence: `Nội dung phần ${index}`,
          sourcePages: [index + 1],
        },
      ],
      excludedReason: '',
    };
  }

  function question(chunkIndex: number, index: number): QualityQuestion {
    return {
      type: 'single_choice',
      content: `Câu hỏi phần ${chunkIndex} số ${index}?`,
      explanation: 'Đáp án đúng phản ánh chính xác nội dung kiến thức nguồn.',
      options: [
        { content: `Đúng ${chunkIndex}-${index}`, isCorrect: true },
        { content: `Sai A ${chunkIndex}-${index}`, isCorrect: false },
        { content: `Sai B ${chunkIndex}-${index}`, isCorrect: false },
        { content: `Sai C ${chunkIndex}-${index}`, isCorrect: false },
      ],
      objectiveId: 'O1',
      cognitiveLevel: 'understand',
      category: 'core_concept',
      sourcePages: [chunkIndex + 1],
      sourceEvidence: '',
    };
  }

  function row(index: number) {
    return {
      jobId: JOB_ID,
      chunkIndex: index,
      startPage: index + 1,
      endPage: index + 1,
      text: `Nội dung phần ${index} dùng để kiểm tra concurrency`,
      analysis: null as QuizChunkAnalysis | null,
      analysisInputTokens: 0,
      analysisOutputTokens: 0,
      status: AiGenerationChunkStatus.PENDING,
      candidateQuestions: null as QualityQuestion[] | null,
      inputTokens: 0,
      outputTokens: 0,
      attempts: 0,
      lastError: null as string | null,
    };
  }

  function context(configValues: Record<string, number>) {
    const job = {
      id: JOB_ID,
      teacherId: 'teacher-id',
      generationTotalChunks: null,
      generationProcessedChunks: 0,
      stage: AiGenerationJobStage.GENERATING_QUIZ,
      status: AiGenerationJobStatus.RUNNING,
    };
    const jobs = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(job)),
      update: jest.fn((_id: string, value: Record<string, unknown>) =>
        Promise.resolve(Object.assign(job, value)),
      ),
    };
    const chunks = {
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    };
    const service = new AiQuizGenerationService(
      jobs as never,
      {} as never,
      chunks as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config as never,
    );
    return { service, job, jobs, chunks };
  }

  it('guards retry status update with the failed attempt number', async () => {
    const { service, jobs } = context({});
    await service.markRetrying(JOB_ID, new Error('temporary failure'), 2);
    expect(jobs.update).toHaveBeenCalledWith(
      {
        id: JOB_ID,
        status: AiGenerationJobStatus.RUNNING,
        attemptCount: 2,
      },
      expect.objectContaining({
        status: AiGenerationJobStatus.PENDING,
        stage: AiGenerationJobStage.QUEUED,
      }),
    );
    expect(String(jobs.update.mock.calls[0]?.[1].errorMessage)).toContain(
      'Lần xử lý 2',
    );
  });

  it('analyzes only missing chunks with cap 2 and returns deterministic order', async () => {
    const { service, job, jobs, chunks } = context({
      AI_GENERATION_CHUNK_ANALYSIS_CONCURRENCY: 2,
    });
    const rows = Array.from({ length: 5 }, (_, index) => row(index));
    rows[0].analysis = analysis(0);
    rows[0].analysisInputTokens = 5;
    rows[0].analysisOutputTokens = 7;
    const gates = Array.from({ length: 5 }, () =>
      deferred<{
        value: QuizChunkAnalysis;
        inputTokens: number;
        outputTokens: number;
      }>(),
    );
    const started: number[] = [];
    let active = 0;
    let maxActive = 0;
    const completeCanonicalJson = jest.fn(async (args: { prompt: string }) => {
      const index = Number(/Phân tích chunk (\d+)/.exec(args.prompt)?.[1]);
      started.push(index);
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        return await gates[index].promise;
      } finally {
        active -= 1;
      }
    });
    service['completeCanonicalJson'] = completeCanonicalJson as never;

    const resultPromise = service['analyzeDocumentChunks'](
      job as never,
      dto,
      provider as never,
      rows as never,
    );
    await nextTurn();
    expect(started).toEqual([1, 2]);
    gates[2].resolve({ value: analysis(2), inputTokens: 12, outputTokens: 22 });
    await nextTurn();
    gates[3].resolve({ value: analysis(3), inputTokens: 13, outputTokens: 23 });
    await nextTurn();
    gates[4].resolve({ value: analysis(4), inputTokens: 14, outputTokens: 24 });
    await nextTurn();
    gates[1].resolve({ value: analysis(1), inputTokens: 11, outputTokens: 21 });

    const result = await resultPromise;
    expect(maxActive).toBe(2);
    expect(started).toEqual([1, 2, 3, 4]);
    expect(result.analyses.map((value) => value.chunkIndex)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(result.inputTokens).toBe(55);
    expect(result.outputTokens).toBe(97);
    expect(chunks.save).toHaveBeenCalledTimes(4);
    expect(
      jobs.update.mock.calls.map(
        ([, value]) => value.generationProcessedChunks,
      ),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it('generates missing candidates with cap 2 and flattens by chunk index', async () => {
    const { service, job, jobs } = context({
      AI_GENERATION_CHUNK_CANDIDATE_CONCURRENCY: 2,
    });
    const rows = Array.from({ length: 4 }, (_, index) => row(index));
    const analyses = rows.map((value) => {
      value.analysis = analysis(value.chunkIndex);
      return value.analysis;
    });
    rows[0].status = AiGenerationChunkStatus.COMPLETED;
    rows[0].candidateQuestions = [0, 1, 2].map((index) => question(0, index));
    rows[0].inputTokens = 5;
    rows[0].outputTokens = 7;
    const blueprint: QuizBlueprint = {
      documentKind: 'general_subject',
      language: 'vi',
      overview: 'Blueprint kiểm thử xử lý song song',
      targetAudience: 'Học sinh',
      objectives: [
        {
          id: 'O1',
          title: 'Kiến thức trọng tâm',
          description: 'Hiểu kiến thức trọng tâm của tất cả các phần',
          weight: 100,
          sourceChunkIndexes: [0, 1, 2, 3],
          sourcePages: [1, 2, 3, 4],
          preferredCategories: ['core_concept'],
        },
      ],
      excludedContent: [],
      readingEvidenceRequired: false,
      grammarRuleExplanationRequired: false,
    };
    const gates = Array.from({ length: 4 }, () =>
      deferred<{
        value: QualityQuestion[];
        inputTokens: number;
        outputTokens: number;
      }>(),
    );
    const started: number[] = [];
    let active = 0;
    let maxActive = 0;
    service['completeCanonicalJson'] = jest.fn(
      async (args: { prompt: string }) => {
        const index = Number(/cho chunk (\d+)/.exec(args.prompt)?.[1]);
        started.push(index);
        active += 1;
        maxActive = Math.max(maxActive, active);
        try {
          return await gates[index].promise;
        } finally {
          active -= 1;
        }
      },
    ) as never;

    const resultPromise = service['generateChunkCandidates'](
      job as never,
      dto,
      provider as never,
      rows as never,
      analyses,
      blueprint,
      buildCognitiveDistribution(dto.questionCount),
    );
    await nextTurn();
    expect(started).toEqual([1, 2]);
    gates[2].resolve({
      value: [0, 1, 2].map((index) => question(2, index)),
      inputTokens: 12,
      outputTokens: 22,
    });
    await nextTurn();
    gates[3].resolve({
      value: [0, 1, 2].map((index) => question(3, index)),
      inputTokens: 13,
      outputTokens: 23,
    });
    await nextTurn();
    gates[1].resolve({
      value: [0, 1, 2].map((index) => question(1, index)),
      inputTokens: 11,
      outputTokens: 21,
    });

    const result = await resultPromise;
    expect(maxActive).toBe(2);
    expect(started).toEqual([1, 2, 3]);
    expect(result.questions.map((value) => value.content)).toEqual(
      [0, 1, 2, 3].flatMap((chunkIndex) =>
        [0, 1, 2].map((index) => `Câu hỏi phần ${chunkIndex} số ${index}?`),
      ),
    );
    expect(result.inputTokens).toBe(41);
    expect(result.outputTokens).toBe(73);
    expect(
      rows.every((value) => value.status === AiGenerationChunkStatus.COMPLETED),
    ).toBe(true);
    expect(
      jobs.update.mock.calls.map(
        ([, value]) => value.generationProcessedChunks,
      ),
    ).toEqual([1, 2, 3, 4]);
  });

  it('does not double-count an invalid analysis checkpoint', async () => {
    const { service, job, jobs, chunks } = context({
      AI_GENERATION_CHUNK_ANALYSIS_CONCURRENCY: 3,
    });
    const rows = [row(0), row(1)];
    rows[0].analysis = { invalid: true } as never;
    rows[1].analysis = analysis(1);
    service['completeCanonicalJson'] = jest.fn().mockResolvedValue({
      value: analysis(0),
      inputTokens: 10,
      outputTokens: 5,
    }) as never;

    const result = await service['analyzeDocumentChunks'](
      job as never,
      dto,
      provider as never,
      rows as never,
    );

    expect(result.analyses.map((value) => value.chunkIndex)).toEqual([0, 1]);
    expect(chunks.save).toHaveBeenCalledTimes(1);
    expect(
      jobs.update.mock.calls.map(
        ([, value]) => value.generationProcessedChunks,
      ),
    ).toEqual([1, 2]);
  });

  it('drains in-flight candidate work before propagating a partial failure', async () => {
    const { service, job } = context({
      AI_GENERATION_CHUNK_CANDIDATE_CONCURRENCY: 2,
    });
    const rows = Array.from({ length: 3 }, (_, index) => row(index));
    const analyses = rows.map((value) => {
      value.analysis = analysis(value.chunkIndex);
      return value.analysis;
    });
    const blueprint: QuizBlueprint = {
      documentKind: 'general_subject',
      language: 'vi',
      overview: 'Blueprint kiểm thử lỗi một phần',
      targetAudience: 'Học sinh',
      objectives: [
        {
          id: 'O1',
          title: 'Kiến thức trọng tâm',
          description: 'Hiểu kiến thức trọng tâm của tài liệu',
          weight: 100,
          sourceChunkIndexes: [0, 1, 2],
          sourcePages: [1, 2, 3],
          preferredCategories: ['core_concept'],
        },
      ],
      excludedContent: [],
      readingEvidenceRequired: false,
      grammarRuleExplanationRequired: false,
    };
    const gates = Array.from({ length: 3 }, () =>
      deferred<{
        value: QualityQuestion[];
        inputTokens: number;
        outputTokens: number;
      }>(),
    );
    const started: number[] = [];
    service['completeCanonicalJson'] = jest.fn(
      async (args: { prompt: string }) => {
        const index = Number(/cho chunk (\d+)/.exec(args.prompt)?.[1]);
        started.push(index);
        return gates[index].promise;
      },
    ) as never;
    let settled = false;
    const outcome = service['generateChunkCandidates'](
      job as never,
      dto,
      provider as never,
      rows as never,
      analyses,
      blueprint,
      buildCognitiveDistribution(dto.questionCount),
    ).then(
      () => ({ error: null }),
      (error: unknown) => ({ error }),
    );
    void outcome.finally(() => {
      settled = true;
    });

    await nextTurn();
    expect(started).toEqual([0, 1]);
    const providerError = new Error('provider rate limited');
    gates[1].reject(providerError);
    await nextTurn();
    expect(settled).toBe(false);
    expect(started).toEqual([0, 1]);

    gates[0].resolve({
      value: [0, 1, 2, 3].map((index) => question(0, index)),
      inputTokens: 10,
      outputTokens: 5,
    });
    const result = await outcome;
    expect(result.error).toBe(providerError);
    expect(started).toEqual([0, 1]);
    expect(rows.map((value) => value.status)).toEqual([
      AiGenerationChunkStatus.COMPLETED,
      AiGenerationChunkStatus.FAILED,
      AiGenerationChunkStatus.PENDING,
    ]);
    expect(rows[1].lastError).toContain('provider rate limited');
  });
});

describe('AiQuizGenerationService analysis provider routing', () => {
  const ANALYSIS_PROVIDER_ID = '00000000-0000-4000-8000-000000000030';
  const quizProvider = { id: QUIZ_PROVIDER_ID, name: 'Quality AI' };
  const analysisProvider = { id: ANALYSIS_PROVIDER_ID, name: 'Fast AI' };

  function serviceWith(resolve: jest.Mock) {
    return new AiQuizGenerationService(
      {} as never,
      {} as never,
      {} as never,
      { resolve } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('uses the analysis provider pinned on the job', async () => {
    const resolve = jest.fn().mockResolvedValue(analysisProvider);
    const service = serviceWith(resolve);

    await expect(
      service['resolveAnalysisProvider'](
        { id: JOB_ID, analysisProviderId: ANALYSIS_PROVIDER_ID } as never,
        quizProvider as never,
      ),
    ).resolves.toBe(analysisProvider);
    expect(resolve).toHaveBeenCalledWith(ANALYSIS_PROVIDER_ID);
  });

  it('uses the quiz provider when the job pins no analysis provider', async () => {
    const resolve = jest.fn();
    const service = serviceWith(resolve);

    await expect(
      service['resolveAnalysisProvider'](
        { id: JOB_ID, analysisProviderId: null } as never,
        quizProvider as never,
      ),
    ).resolves.toBe(quizProvider);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('falls back to the quiz provider when the pinned analysis provider is gone', async () => {
    // Job retry sau khi admin tắt/xóa provider phân tích: nhiệm vụ này là tùy
    // chọn nên job phải chạy tiếp thay vì chết.
    const resolve = jest.fn().mockRejectedValue(new Error('provider đã tắt'));
    const service = serviceWith(resolve);

    await expect(
      service['resolveAnalysisProvider'](
        { id: JOB_ID, analysisProviderId: ANALYSIS_PROVIDER_ID } as never,
        quizProvider as never,
      ),
    ).resolves.toBe(quizProvider);
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
