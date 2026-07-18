import { BadRequestException } from '@nestjs/common';
import {
  AiRequestError,
  categoryFromHttpStatus,
  categoryFromProviderFailure,
  isContentPolicyError,
  isNonRetryableAiError,
  isRetryableHttpStatus,
  providerErrorMessage,
  sanitizeProviderMessage,
} from './ai-error';
import {
  compileStrictSchema,
  resolveStructuredOutput,
  resolveStructuredOutputMode,
} from './ai-structured-output.adapter';
import { AiModelClientService } from './ai-model-client.service';
import { AiProviderSdkError } from './ai-provider-sdk.service';
import {
  AiQuizGenerationService,
  validateGeneratedQuestions,
} from './ai-quiz-generation.service';
import { AiMaterialSourceService } from './ai-material-source.service';
import {
  chunkAnalysisOutputSchema,
  qualityQuestionsOutputSchema,
  quizBlueprintOutputSchema,
} from './prompts/quiz-quality.prompt';
import { AiProviderKind } from './entities/ai-provider.entity';

const UNSUPPORTED_KEYWORDS = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minLength',
  'maxLength',
];

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

function provider(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    name: 'Test Provider',
    kind: AiProviderKind.OPENAI_COMPATIBLE,
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-4-5-20251001',
    ...overrides,
  } as never;
}

describe('AiStructuredOutputAdapter', () => {
  it('strips unsupported keywords from every canonical schema in strict mode', () => {
    for (const schema of [
      chunkAnalysisOutputSchema(),
      quizBlueprintOutputSchema(),
      qualityQuestionsOutputSchema(undefined, 10),
    ]) {
      const compiled = compileStrictSchema(schema);
      const keys = collectKeys(compiled);
      for (const keyword of UNSUPPORTED_KEYWORDS)
        expect(keys.has(keyword)).toBe(false);
      // Canonical schema giữ nguyên ràng buộc — không bị hạ cấp.
      expect(
        UNSUPPORTED_KEYWORDS.some((keyword) =>
          collectKeys(schema).has(keyword),
        ),
      ).toBe(true);
    }
  });

  it('folds dropped constraints into description text', () => {
    const compiled = compileStrictSchema({
      type: 'array',
      minItems: 2,
      maxItems: 6,
      uniqueItems: true,
      items: { type: 'integer', minimum: 1, maximum: 100 },
    });
    expect(String(compiled.description)).toContain('từ 2 đến 6 phần tử');
    expect(String(compiled.description)).toContain('không được trùng lặp');
    expect(
      String((compiled.items as Record<string, unknown>).description),
    ).toContain('từ 1 đến 100');
  });

  it('selects mode per provider and model capability', () => {
    expect(
      resolveStructuredOutputMode(
        provider({ baseUrl: 'https://api.anthropic.com/v1' }),
      ),
    ).toBe('strict_schema');
    expect(
      resolveStructuredOutputMode(
        provider({ baseUrl: 'https://api.deepseek.com' }),
      ),
    ).toBe('json_object');
    expect(
      resolveStructuredOutputMode(
        provider({
          baseUrl: 'https://api.groq.com/openai/v1',
          model: 'openai/gpt-oss-120b',
        }),
      ),
    ).toBe('strict_schema');
    expect(
      resolveStructuredOutputMode(
        provider({
          baseUrl: 'https://api.groq.com/openai/v1',
          model: 'llama-3.3-70b-versatile',
        }),
      ),
    ).toBe('json_object');
    expect(
      resolveStructuredOutputMode(
        provider({
          kind: AiProviderKind.OLLAMA,
          baseUrl: 'http://localhost:11434',
        }),
      ),
    ).toBe('strict_schema');
  });

  it('keeps raw canonical schema for Ollama and embeds schema in prompt for json_object', () => {
    const schema = chunkAnalysisOutputSchema();
    const ollamaPlan = resolveStructuredOutput(
      provider({
        kind: AiProviderKind.OLLAMA,
        baseUrl: 'http://localhost:11434',
      }),
      schema,
    );
    expect(ollamaPlan.schema).toBe(schema);
    const deepseekPlan = resolveStructuredOutput(
      provider({ baseUrl: 'https://api.deepseek.com' }),
      schema,
    );
    expect(deepseekPlan.schema).toBeNull();
    expect(deepseekPlan.promptInstruction).toContain('chunkIndex');
    expect(deepseekPlan.promptInstruction).toContain('JSON');
  });
});

describe('AiRequestError classification', () => {
  it('categorizes HTTP status and retryability', () => {
    expect(categoryFromHttpStatus(400)).toBe('provider_schema_error');
    expect(categoryFromHttpStatus(401)).toBe('provider_auth_error');
    expect(categoryFromHttpStatus(403)).toBe('provider_auth_error');
    expect(categoryFromHttpStatus(404)).toBe('provider_schema_error');
    expect(categoryFromHttpStatus(429)).toBe('provider_rate_limit');
    expect(categoryFromHttpStatus(500)).toBe('provider_server_error');
    expect(isRetryableHttpStatus(400)).toBe(false);
    expect(isRetryableHttpStatus(401)).toBe(false);
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);
  });

  it('categorizes provider content filtering as a refusal instead of a schema error', () => {
    const message =
      'invalid_request_error: Output blocked by content filtering policy';
    expect(categoryFromProviderFailure(400, message)).toBe('provider_refusal');
    expect(
      categoryFromProviderFailure(
        400,
        'invalid_request_error: minItems is not supported',
      ),
    ).toBe('provider_schema_error');
    expect(
      isContentPolicyError(
        new AiRequestError('Model AI không đọc được hình ảnh', {
          category: 'provider_refusal',
          retryable: false,
          providerMessage: message,
        }),
      ),
    ).toBe(true);
  });

  it('detects non-retryable errors for the queue', () => {
    expect(
      isNonRetryableAiError(
        new AiRequestError('schema', {
          category: 'provider_schema_error',
          retryable: false,
        }),
      ),
    ).toBe(true);
    expect(
      isNonRetryableAiError(
        new AiRequestError('rate limit', {
          category: 'provider_rate_limit',
          retryable: true,
        }),
      ),
    ).toBe(false);
    expect(isNonRetryableAiError(new BadRequestException('tài liệu'))).toBe(
      true,
    );
    expect(isNonRetryableAiError(new Error('mạng rớt'))).toBe(false);
  });

  it('extracts provider error message from wrapped bodies and masks api key', () => {
    expect(
      providerErrorMessage(
        '{"error":{"type":"invalid_request_error","message":"minItems is not supported"}}',
      ),
    ).toBe('invalid_request_error: minItems is not supported');
    expect(providerErrorMessage('{"error":"model not found"}')).toBe(
      'model not found',
    );
    expect(providerErrorMessage('Bad Gateway')).toBe('Bad Gateway');
    expect(
      sanitizeProviderMessage('leaked sk-abc123 in body', 'sk-abc123'),
    ).toBe('leaked [đã che api key] in body');
  });
});

describe('AiModelClientService provider failures', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function client(usage = { recordSafely: jest.fn().mockResolvedValue(null) }) {
    const providers = { apiKey: jest.fn().mockReturnValue('sk-test') };
    const urlPolicy = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
    const sdkGenerate = jest.fn();
    return {
      service: new AiModelClientService(
        providers as never,
        urlPolicy as never,
        usage as never,
        { generate: sdkGenerate } as never,
      ),
      usage,
      sdkGenerate,
    };
  }

  const usageContext = {
    source: 'quiz_generation' as const,
    referenceId: null,
    userId: null,
  };

  it('keeps provider error body, categorizes HTTP 400 as non-retryable schema error', async () => {
    const { service, usage, sdkGenerate } = client();
    sdkGenerate.mockRejectedValue(
      new AiProviderSdkError(
        'invalid_request_error: output_config.format.schema: minItems is unsupported',
        400,
      ),
    );
    const call = service.completeJson(
      provider(),
      'system',
      'prompt',
      usageContext,
      chunkAnalysisOutputSchema(),
    );
    await expect(call).rejects.toThrow('minItems is unsupported');
    const error = await call.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiRequestError);
    expect((error as AiRequestError).details.category).toBe(
      'provider_schema_error',
    );
    expect((error as AiRequestError).details.retryable).toBe(false);
    expect((error as AiRequestError).details.statusCode).toBe(400);
    expect(usage.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'provider_schema_error',
        httpStatus: 400,
        status: 'failed',
      }),
    );
  });

  it('marks HTTP 429 as retryable rate limit', async () => {
    const { service, sdkGenerate } = client();
    sdkGenerate.mockRejectedValue(new AiProviderSdkError('rate limited', 429));
    const error = await service
      .completeJson(
        provider({ baseUrl: 'https://api.deepseek.com' }),
        'system',
        'prompt',
        usageContext,
        chunkAnalysisOutputSchema(),
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiRequestError);
    expect((error as AiRequestError).details.category).toBe(
      'provider_rate_limit',
    );
    expect((error as AiRequestError).details.retryable).toBe(true);
  });

  it('keeps the content-filter body and marks vision HTTP 400 as provider refusal', async () => {
    const { service, usage, sdkGenerate } = client();
    sdkGenerate.mockRejectedValue(
      new AiProviderSdkError(
        'invalid_request_error: Output blocked by content filtering policy',
        400,
      ),
    );
    const error = await service
      .readImageText(
        provider(),
        Buffer.from('image'),
        'image/png',
        { ...usageContext, source: 'document_vision_ocr' },
        3,
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiRequestError);
    expect((error as AiRequestError).details).toMatchObject({
      category: 'provider_refusal',
      retryable: false,
      statusCode: 400,
      providerMessage:
        'invalid_request_error: Output blocked by content filtering policy',
    });
    expect(usage.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'provider_refusal',
        status: 'failed',
      }),
    );
  });

  it('sends compiled schema to Anthropic without unsupported keywords', async () => {
    const { service, sdkGenerate } = client();
    sdkGenerate.mockResolvedValue({
      content: '{"ok":true}',
      inputTokens: 1,
      outputTokens: 1,
      cacheInputTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      providerCostUsd: null,
      providerRequestId: null,
      finishReason: 'end_turn',
      refused: false,
      truncated: false,
      httpStatus: 200,
    });
    await service.completeJson(
      provider(),
      'system',
      'prompt',
      usageContext,
      chunkAnalysisOutputSchema(),
    );
    const sentSchema = sdkGenerate.mock.calls[0][0].plan.schema as Record<
      string,
      unknown
    >;
    const keys = collectKeys(sentSchema);
    for (const keyword of UNSUPPORTED_KEYWORDS)
      expect(keys.has(keyword)).toBe(false);
  });

  it('sends json_object and schema-in-prompt to DeepSeek', async () => {
    const { service, sdkGenerate } = client();
    sdkGenerate.mockResolvedValue({
      content: '{"ok":true}',
      inputTokens: 1,
      outputTokens: 1,
      cacheInputTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      providerCostUsd: null,
      providerRequestId: null,
      finishReason: 'stop',
      refused: false,
      truncated: false,
      httpStatus: 200,
    });
    await service.completeJson(
      provider({ baseUrl: 'https://api.deepseek.com' }),
      'system',
      'prompt',
      usageContext,
      chunkAnalysisOutputSchema(),
    );
    const input = sdkGenerate.mock.calls[0][0] as {
      plan: { mode: string };
      prompt: string;
    };
    expect(input.plan.mode).toBe('json_object');
    expect(input.prompt).toContain('chunkIndex');
    expect(input.prompt).toContain('JSON Schema');
  });
});

describe('validateGeneratedQuestions field paths', () => {
  it('reports issues with concrete field paths', () => {
    const call = () =>
      validateGeneratedQuestions(
        {
          questions: [
            {
              type: 'single_choice',
              content: 'Sai schema',
              options: [
                { content: 'A', isCorrect: true },
                { content: 'B', isCorrect: true },
              ],
            },
          ],
        },
        1,
      );
    expect(call).toThrow('questions[0].options');
    expect(call).toThrow('số lựa chọn hoặc đáp án đúng');
    try {
      call();
    } catch (error) {
      expect(error).toBeInstanceOf(AiRequestError);
      expect((error as AiRequestError).details.category).toBe(
        'canonical_validation_error',
      );
      expect((error as AiRequestError).details.retryable).toBe(false);
      expect((error as AiRequestError).details.validationIssues[0]).toContain(
        'questions[0].options',
      );
    }
  });
});

describe('AiQuizGenerationService repair-once flow', () => {
  const usageContext = {
    source: 'quiz_generation' as const,
    referenceId: 'job-1',
    userId: 'teacher-1',
  };

  function serviceWithClient(completeJson: jest.Mock) {
    return new AiQuizGenerationService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { completeJson } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('repairs exactly once with issue list, then succeeds', async () => {
    const completeJson = jest
      .fn()
      .mockResolvedValueOnce({
        value: { questions: [] },
        inputTokens: 10,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({
        value: { questions: ['ok'] },
        inputTokens: 7,
        outputTokens: 3,
      });
    const service = serviceWithClient(completeJson);
    const parse = (value: unknown) => {
      const questions = (value as { questions: unknown[] }).questions;
      if (!questions.length)
        throw new AiRequestError('thiếu câu hỏi', {
          category: 'canonical_validation_error',
          retryable: false,
          validationIssues: ['questions: cần đúng 1 câu hỏi, nhận được 0'],
        });
      return questions;
    };
    const result = await service['completeCanonicalJson']({
      provider: provider(),
      system: 'system',
      prompt: 'prompt gốc',
      usageContext,
      schema: {},
      parse,
    });
    expect(result.value).toEqual(['ok']);
    expect(result.inputTokens).toBe(17);
    expect(result.outputTokens).toBe(8);
    expect(completeJson).toHaveBeenCalledTimes(2);
    const repairCalls = completeJson.mock.calls as unknown as Array<
      [unknown, unknown, string]
    >;
    const repairedPrompt = repairCalls[1][2];
    expect(repairedPrompt).toContain('prompt gốc');
    expect(repairedPrompt).toContain('KHÔNG HỢP LỆ');
    expect(repairedPrompt).toContain('cần đúng 1 câu hỏi');
  });

  it('fails with full issues after one repair, never loops', async () => {
    const completeJson = jest.fn().mockResolvedValue({
      value: { questions: [] },
      inputTokens: 1,
      outputTokens: 1,
    });
    const service = serviceWithClient(completeJson);
    const parse = () => {
      throw new AiRequestError('thiếu câu hỏi', {
        category: 'canonical_validation_error',
        retryable: false,
        validationIssues: ['questions: cần đúng 2 câu hỏi, nhận được 0'],
      });
    };
    const call = service['completeCanonicalJson']({
      provider: provider(),
      system: 'system',
      prompt: 'prompt gốc',
      usageContext,
      schema: {},
      parse,
    });
    const error = await call.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiRequestError);
    expect((error as AiRequestError).details.retryable).toBe(false);
    expect((error as AiRequestError).details.validationIssues).toContain(
      'questions: cần đúng 2 câu hỏi, nhận được 0',
    );
    expect(completeJson).toHaveBeenCalledTimes(2);
  });

  it('does not repair provider errors — they go to the retry policy', async () => {
    const completeJson = jest.fn().mockRejectedValue(
      new AiRequestError('Provider AI trả lỗi (HTTP 400)', {
        category: 'provider_schema_error',
        retryable: false,
      }),
    );
    const service = serviceWithClient(completeJson);
    await expect(
      service['completeCanonicalJson']({
        provider: provider(),
        system: 'system',
        prompt: 'prompt',
        usageContext,
        schema: {},
        parse: (value: unknown) => value,
      }),
    ).rejects.toThrow('HTTP 400');
    expect(completeJson).toHaveBeenCalledTimes(1);
  });
});

describe('AiMaterialSourceService local OCR check', () => {
  it('memoizes the tesseract availability check', async () => {
    const service = new AiMaterialSourceService({} as never);
    const first = service['localOcrAvailable']();
    const second = service['localOcrAvailable']();
    expect(second).toBe(first);
    await expect(first).resolves.toEqual(expect.any(Boolean));
  });

  it('skips only a vision page blocked by content policy', async () => {
    const readImageText = jest.fn().mockRejectedValue(
      new AiRequestError('Model AI không đọc được hình ảnh', {
        category: 'provider_refusal',
        retryable: false,
        providerMessage:
          'invalid_request_error: Output blocked by content filtering policy',
      }),
    );
    const service = new AiMaterialSourceService({ readImageText } as never);
    const page = await service['extractVisionPage'](
      {
        provider: provider(),
        referenceId: 'job-1',
        userId: 'teacher-1',
      },
      Buffer.from('image'),
      3,
    );
    expect(page).toEqual({
      pageNumber: 3,
      text: '',
      method: 'ai_vision',
      confidence: null,
      visionInputTokens: 0,
      visionOutputTokens: 0,
      failureCategory: 'provider_blocked',
    });
  });

  it('does not hide non-policy vision errors', async () => {
    const error = new AiRequestError('quota exceeded', {
      category: 'provider_rate_limit',
      retryable: true,
    });
    const service = new AiMaterialSourceService({
      readImageText: jest.fn().mockRejectedValue(error),
    } as never);
    await expect(
      service['extractVisionPage'](
        {
          provider: provider(),
          referenceId: 'job-1',
          userId: 'teacher-1',
        },
        Buffer.from('image'),
        3,
      ),
    ).rejects.toBe(error);
  });
});
