import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { AuthModule } from '@/modules/auth/auth.module';
import { UserModule } from '@/modules/user/user.module';
import { UploadFileModule } from '@/modules/upload-file/upload-file.module';
import { ClassroomModule } from '@/modules/classroom/classroom.module';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { AiModule } from '@/modules/ai/ai.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { RedisThrottlerStorage } from '@/common/security/redis-throttler.storage';
import { ApiExceptionFilter } from '@/common/filters/api-exception.filter';

// File đứng trước có độ ưu tiên cao hơn (không bị file sau override)
const envFiles =
  process.env.NODE_ENV === 'production'
    ? ['.env']
    : ['.env.local', '.env.development', '.env'];

// Anchor theo vị trí file build (apps/api/dist) thay vì cwd để API chỉ đọc
// env thuộc apps/api, dù được chạy từ root monorepo.
const appDir = join(__dirname, '..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFiles.map((file) => join(appDir, file)),
    }),
    ThrottlerModule.forRoot([
      { name: 'burst', ttl: 10_000, limit: 30, blockDuration: 30_000 },
      { name: 'default', ttl: 60_000, limit: 300, blockDuration: 60_000 },
      {
        name: 'sustained',
        ttl: 3_600_000,
        limit: 3_000,
        blockDuration: 900_000,
      },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        database: config.get<string>('DATABASE_NAME', 'zunibee'),
        username: config.get<string>('DATABASE_USER', 'postgres'),
        password: config.get<string>('DATABASE_PASSWORD', ''),
        autoLoadEntities: true,
        // Schema chỉ được thay đổi thông qua migration ở mọi môi trường.
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    AuthModule,
    UserModule,
    UploadFileModule,
    ClassroomModule,
    QuizModule,
    AiModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RedisThrottlerStorage,
    { provide: ThrottlerStorage, useExisting: RedisThrottlerStorage },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
