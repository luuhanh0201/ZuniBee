import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseJsonContent } from './ai-model-client.service';
import {
  calculateCharge,
  estimateReservedCredits,
  validateGeneratedQuestions,
} from './ai-quiz-generation.service';
import { resolveCreditSettlement } from './ai-credit.service';
import { AiSecretService } from './ai-secret.service';
import { validateInsight } from './quiz-weakness-insight.service';

describe('AI Phase 2/3 pure logic', () => {
  it('parses plain and fenced JSON without accepting invalid content', () => {
    expect(parseJsonContent('{"questions":[]}')).toEqual({ questions: [] });
    expect(parseJsonContent('```json\n{"ok":true}\n```')).toEqual({
      ok: true,
    });
    expect(() => parseJsonContent('not json')).toThrow(BadGatewayException);
  });

  it('validates generated question count, type and correct answers', () => {
    expect(
      validateGeneratedQuestions(
        {
          questions: [
            {
              type: 'single_choice',
              content: '2 + 2 bằng bao nhiêu?',
              explanation: '2 + 2 = 4',
              options: [
                { content: '2', isCorrect: false },
                { content: '3', isCorrect: false },
                { content: '4', isCorrect: true },
                { content: '5', isCorrect: false },
              ],
            },
          ],
        },
        1,
      ),
    ).toHaveLength(1);
    expect(() =>
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
      ),
    ).toThrow('số lựa chọn hoặc đáp án đúng');
  });

  it('reserves conservatively and never charges beyond reservation', () => {
    const reserved = estimateReservedCredits(2, 3, 10);
    expect(reserved).toBe(23);
    expect(calculateCharge(2, 3, 2_100, reserved)).toBe(11);
    expect(resolveCreditSettlement(23, 11)).toEqual({
      safeCharge: 11,
      released: 12,
    });
    expect(resolveCreditSettlement(5, 99)).toEqual({
      safeCharge: 5,
      released: 0,
    });
  });

  it('encrypts provider keys with authenticated encryption', () => {
    const config = {
      get: (key: string) =>
        key === 'AI_PROVIDER_ENCRYPTION_KEY'
          ? 'test-key-with-at-least-32-characters'
          : 'test',
    } as ConfigService;
    const service = new AiSecretService(config);
    const encrypted = service.encrypt('secret-api-key');
    expect(encrypted).not.toContain('secret-api-key');
    expect(service.decrypt(encrypted)).toBe('secret-api-key');
  });

  it('creates and reuses a production encryption key file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zunibee-ai-secret-'));
    const keyFile = join(directory, 'provider.key');
    const config = {
      get: (key: string, fallback?: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'AI_PROVIDER_ENCRYPTION_KEY_FILE') return keyFile;
        return fallback;
      },
    } as ConfigService;
    try {
      const first = new AiSecretService(config);
      const encrypted = first.encrypt('persistent-api-key');
      expect(existsSync(keyFile)).toBe(true);
      const afterRestart = new AiSecretService(config);
      expect(afterRestart.decrypt(encrypted)).toBe('persistent-api-key');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('validates weakness insight without accepting non-string arrays', () => {
    expect(
      validateInsight({
        summary: 'Lớp nắm tốt kiến thức nền.',
        strengths: ['Câu 1'],
        weaknesses: ['Câu 2'],
        recommendations: ['Ôn lại chương 2'],
      }),
    ).toMatchObject({ weaknesses: ['Câu 2'] });
    expect(() =>
      validateInsight({
        summary: 'x',
        strengths: [1],
        weaknesses: [],
        recommendations: [],
      }),
    ).toThrow('strengths');
  });
});
