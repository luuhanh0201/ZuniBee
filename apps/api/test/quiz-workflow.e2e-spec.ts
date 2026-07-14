import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { User } from '@/modules/user/entities/user.entity';

process.env.NODE_ENV = 'test';

describe('Quiz workflow (e2e)', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App> | undefined;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = 'ZuniBee@123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      const dataSource = app.get(DataSource);
      await dataSource
        .getRepository(User)
        .createQueryBuilder()
        .delete()
        .where('email LIKE :pattern', { pattern: '%@zunibee.test' })
        .execute();
    }
    await app?.close();
  });

  it('covers assign, resume, submit, release policy, analytics and Excel', async () => {
    if (!app) throw new Error('Ứng dụng kiểm thử chưa khởi tạo');
    const teacher = await register(
      `teacher-${suffix}@zunibee.test`,
      'Giáo viên E2E',
      'teacher',
    );
    const student = await register(
      `student-${suffix}@zunibee.test`,
      'Học sinh E2E',
      'student',
    );

    const classroom = await request(app.getHttpServer())
      .post('/api/v1/classrooms')
      .set('Authorization', `Bearer ${teacher.accessToken}`)
      .send({ name: `Lớp E2E ${suffix}`, subject: 'Toán' })
      .expect(201)
      .then((response) => response.body as { id: string; joinCode: string });

    await request(app.getHttpServer())
      .post('/api/v1/classrooms/join/code')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ code: classroom.joinCode })
      .expect(200);

    let quiz = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${teacher.accessToken}`)
      .send({ title: `Quiz E2E ${suffix}` })
      .expect(201)
      .then((response) => response.body as QuizResponse);

    quiz = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quiz.id}/questions`)
      .set('Authorization', `Bearer ${teacher.accessToken}`)
      .send({
        type: 'single_choice',
        content: 'Một cộng một bằng mấy?',
        explanation: 'Một cộng một bằng hai.',
        showExplanation: true,
        options: [
          { content: '2', isCorrect: true },
          { content: '3', isCorrect: false },
        ],
      })
      .expect(201)
      .then((response) => response.body as QuizResponse);

    await request(app.getHttpServer())
      .patch(`/api/v1/quizzes/${quiz.id}/configure`)
      .set('Authorization', `Bearer ${teacher.accessToken}`)
      .send({
        visibility: 'private_class',
        resultReleaseMode: 'hidden',
        showCorrectAnswers: false,
        showExplanations: false,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quiz.id}/assignments`)
      .set('Authorization', `Bearer ${teacher.accessToken}`)
      .send({ targetType: 'classroom', targetId: classroom.id })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quiz.id}/publish`)
      .set('Authorization', `Bearer ${teacher.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/quizzes/student/mine')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200)
      .expect(({ body }: { body: Array<{ id: string; state: string }> }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: quiz.id, state: 'available' }),
          ]),
        );
      });

    const attempt = await request(app.getHttpServer())
      .post('/api/v1/quiz-attempts')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ quizId: quiz.id })
      .expect(201)
      .then((response) => response.body as { id: string });

    await request(app.getHttpServer())
      .patch(
        `/api/v1/quiz-attempts/${attempt.id}/answers/${quiz.questions[0].id}`,
      )
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ selectedOptionIds: [quiz.questions[0].options[0].id] })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/quiz-attempts/${attempt.id}`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200)
      .expect(({ body }: { body: { answers: Record<string, string[]> } }) => {
        expect(body.answers[quiz.questions[0].id]).toEqual([
          quiz.questions[0].options[0].id,
        ]);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/quiz-attempts/${attempt.id}/submit`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(201)
      .expect(
        ({ body }: { body: { isReleased: boolean; score: number | null } }) => {
          expect(body).toMatchObject({ isReleased: false, score: null });
        },
      );

    await request(app.getHttpServer())
      .get(`/api/v1/quiz-attempts/${attempt.id}/result`)
      .set('Authorization', `Bearer ${teacher.accessToken}`)
      .expect(200)
      .expect(({ body }: { body: { isReleased: boolean; score: number } }) => {
        expect(body).toMatchObject({ isReleased: true, score: 10 });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quiz.id}/analytics`)
      .set('Authorization', `Bearer ${teacher.accessToken}`)
      .expect(200)
      .expect(
        ({
          body,
        }: {
          body: { participantCount: number; averageScore: number };
        }) => {
          expect(body).toMatchObject({ participantCount: 1, averageScore: 10 });
        },
      );

    await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quiz.id}/results.xlsx`)
      .set('Authorization', `Bearer ${teacher.accessToken}`)
      .expect('Content-Type', /spreadsheetml/)
      .expect('Content-Disposition', /\.xlsx/)
      .expect(200)
      .expect((response) => {
        const headers = response.headers as Record<string, string>;
        expect(Number(headers['content-length'])).toBeGreaterThan(1000);
      });
  });

  async function register(
    email: string,
    fullName: string,
    role: 'teacher' | 'student',
  ): Promise<{ accessToken: string }> {
    if (!app) throw new Error('Ứng dụng kiểm thử chưa khởi tạo');
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, fullName, role })
      .expect(201)
      .then((response) => response.body as { accessToken: string });
  }
});

type QuizResponse = {
  id: string;
  questions: Array<{
    id: string;
    options: Array<{ id: string }>;
  }>;
};
