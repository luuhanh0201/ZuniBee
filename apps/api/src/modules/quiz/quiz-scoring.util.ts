import { createHash } from 'node:crypto';
import type { QuizQuestion } from './entities/quiz-question.entity';
import type { QuizAttempt } from './entities/quiz-attempt.entity';

export function redistributeScores(
  totalScore: number,
  count: number,
): number[] {
  if (count <= 0) return [];
  const totalCents = Math.round(totalScore * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from(
    { length: count },
    (_, index) => (base + (index < remainder ? 1 : 0)) / 100,
  );
}

export function gradeAnswer(
  question: Pick<QuizQuestion, 'type' | 'score' | 'options'>,
  selectedOptionIds: string[],
): { isCorrect: boolean; scoreAwarded: number } {
  const selected = [...new Set(selectedOptionIds)].sort();
  const validIds = new Set(question.options.map((option) => option.id));
  if (selected.some((id) => !validIds.has(id))) {
    return { isCorrect: false, scoreAwarded: 0 };
  }
  const correct = question.options
    .filter((option) => option.isCorrect)
    .map((option) => option.id)
    .sort();
  const isCorrect =
    selected.length === correct.length &&
    selected.every((id, index) => id === correct[index]);
  return {
    isCorrect,
    scoreAwarded: isCorrect ? Number(question.score) : 0,
  };
}

export function compareAttemptsForRanking(
  left: Pick<
    QuizAttempt,
    'score' | 'timeTakenSeconds' | 'submittedAt' | 'attemptNumber'
  >,
  right: Pick<
    QuizAttempt,
    'score' | 'timeTakenSeconds' | 'submittedAt' | 'attemptNumber'
  >,
): number {
  return (
    Number(right.score ?? 0) - Number(left.score ?? 0) ||
    (left.timeTakenSeconds ?? Number.MAX_SAFE_INTEGER) -
      (right.timeTakenSeconds ?? Number.MAX_SAFE_INTEGER) ||
    (left.submittedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (right.submittedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
    left.attemptNumber - right.attemptNumber
  );
}

export function anonymizedLabel(quizId: string, identity: string): string {
  const hash = createHash('sha256').update(`${quizId}:${identity}`).digest();
  return `Người dùng#${String(hash.readUInt32BE(0) % 100000).padStart(5, '0')}`;
}
