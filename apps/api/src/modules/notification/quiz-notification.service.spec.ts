import { QuizNotificationService } from './quiz-notification.service';

describe('QuizNotificationService', () => {
  it('queues one best registered attempt, excludes guests and deduplicates repeats', async () => {
    const quiz = { id: 'quiz-id', teacherId: 'teacher-id', title: 'Kiểm tra' };
    const user = {
      id: 'student-id',
      email: 'student@example.com',
      fullName: 'Học sinh',
    };
    const attempts = [
      {
        id: 'guest-attempt',
        quizId: 'quiz-id',
        userId: null,
        user: null,
        score: '10',
        maxScore: '10',
        attemptNumber: 1,
        submittedAt: new Date(),
        timeTakenSeconds: 10,
      },
      {
        id: 'attempt-low',
        quizId: 'quiz-id',
        userId: user.id,
        user,
        score: '5',
        maxScore: '10',
        attemptNumber: 1,
        submittedAt: new Date('2026-01-01'),
        timeTakenSeconds: 30,
      },
      {
        id: 'attempt-best',
        quizId: 'quiz-id',
        userId: user.id,
        user,
        score: '8',
        maxScore: '10',
        attemptNumber: 2,
        submittedAt: new Date('2026-01-02'),
        timeTakenSeconds: 40,
      },
    ];
    const stored = new Map<string, Record<string, unknown>>();
    const outbox = {
      findOne: jest.fn(({ where }: { where: { dedupeKey: string } }) =>
        Promise.resolve(stored.get(where.dedupeKey) ?? null),
      ),
      create: (value: Record<string, unknown>) => value,
      save: jest.fn((value: Record<string, unknown>) => {
        const row = { id: 'outbox-id', createdAt: new Date(), ...value };
        stored.set(value.dedupeKey as string, row);
        return Promise.resolve(row);
      }),
    };
    const service = new QuizNotificationService(
      outbox as never,
      { findOne: jest.fn().mockResolvedValue(quiz) } as never,
      { find: jest.fn().mockResolvedValue(attempts) } as never,
      { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
      { get: jest.fn().mockReturnValue('http://localhost:1111') } as never,
    );
    await expect(
      service.enqueueResults('quiz-id', 'teacher-id'),
    ).resolves.toEqual({ queued: 1, skippedGuests: 1, alreadyQueued: 0 });
    await expect(
      service.enqueueResults('quiz-id', 'teacher-id'),
    ).resolves.toEqual({ queued: 0, skippedGuests: 1, alreadyQueued: 1 });
    expect(outbox.save).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'quiz-result:quiz-id:student-id:attempt-best',
      }),
    );
  });
});
