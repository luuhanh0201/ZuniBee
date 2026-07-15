import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';

async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(AppModule);
  Logger.log('ZuniBee AI worker đã sẵn sàng', 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.stack : String(error),
    'Không thể khởi động ZuniBee AI worker',
  );
  process.exit(1);
});
