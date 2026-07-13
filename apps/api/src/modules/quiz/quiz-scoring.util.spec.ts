import {
  anonymizedLabel,
  compareAttemptsForRanking,
  gradeAnswer,
  redistributeScores,
} from './quiz-scoring.util';
import { QuizQuestionType } from './entities/quiz-question.entity';

describe('quiz scoring utilities', () => {
  it('redistributes every cent without losing the total', () => {
    const scores = redistributeScores(10, 3);
    expect(scores).toEqual([3.34, 3.33, 3.33]);
    expect(scores.reduce((sum, score) => sum + score, 0)).toBe(10);
  });

  it('grades multiple choice using exact set matching', () => {
    const question = {
      type: QuizQuestionType.MULTIPLE_CHOICE,
      score: '5.00',
      options: [
        { id: 'a', isCorrect: true },
        { id: 'b', isCorrect: false },
        { id: 'c', isCorrect: true },
      ],
    } as never;
    expect(gradeAnswer(question, ['c', 'a'])).toEqual({
      isCorrect: true,
      scoreAwarded: 5,
    });
    expect(gradeAnswer(question, ['a'])).toEqual({
      isCorrect: false,
      scoreAwarded: 0,
    });
  });

  it('applies ranking tie breaks in the specified order', () => {
    const early = {
      score: '9',
      timeTakenSeconds: 30,
      submittedAt: new Date('2026-01-01T00:00:00Z'),
      attemptNumber: 2,
    };
    const slow = { ...early, timeTakenSeconds: 40, attemptNumber: 1 };
    expect(compareAttemptsForRanking(early, slow)).toBeLessThan(0);
  });

  it('creates stable quiz-scoped anonymous labels', () => {
    expect(anonymizedLabel('quiz-a', 'user-a')).toBe(
      anonymizedLabel('quiz-a', 'user-a'),
    );
    expect(anonymizedLabel('quiz-a', 'user-a')).not.toBe(
      anonymizedLabel('quiz-b', 'user-a'),
    );
  });
});
