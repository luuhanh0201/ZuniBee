import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';

process.env.NODE_ENV = 'test';

describe('Security controls (e2e)', () => {
  let app: INestApplication<App> | undefined;

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
      }),
    );
    await app.init();
  });

  afterAll(async () => app?.close());

  it('returns 429 after repeated login attempts', async () => {
    if (!app) throw new Error('Ứng dụng kiểm thử chưa khởi tạo');
    const body = {
      email: `rate-limit-${Date.now()}@zunibee.test`,
      password: 'invalid-password',
    };
    for (let index = 0; index < 3; index += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(body)
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(body)
      .expect(429);
  });
});
