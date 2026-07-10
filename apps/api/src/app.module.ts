import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// File đứng trước có độ ưu tiên cao hơn (không bị file sau override)
const envFiles =
  process.env.NODE_ENV === 'production'
    ? ['.env']
    : ['.env.local', '.env.development', '.env.example'];

// Anchor theo vị trí file build (apps/api/dist) thay vì cwd,
// để load được cả env của app lẫn env ở root monorepo dù chạy từ đâu
const appDir = join(__dirname, '..');
const rootDir = join(__dirname, '../../..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFiles.flatMap((file) => [
        join(appDir, file),
        join(rootDir, file),
      ]),
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
