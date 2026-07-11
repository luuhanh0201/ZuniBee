import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from '@/app.module';
import { UPLOAD_ROOT } from '@/modules/upload-file/upload-file.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  const port = configService.get<number>('APP_PORT', 2222);
  const prefix = configService.get<string>('APP_PREFIX', 'api/v1');
  const webUrl = configService.get<string>('WEB_URL', 'http://localhost:1111');

  app.setGlobalPrefix(prefix);
  app.useStaticAssets(UPLOAD_ROOT, { prefix: '/uploads/' });
  app.use(cookieParser());

  app.enableCors({
    origin: webUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ZuniBee API')
    .setDescription('API documentation for ZuniBee')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(port);
  console.log('=====================================================');
  console.log(`| ZuniBee APP: ${webUrl}                |`);
  console.log(`| ZuniBee API: http://localhost:${port}/${prefix}         |`);
  console.log(`| Swagger: http://localhost:${port}/docs               |`);
  console.log('=====================================================');
}

bootstrap().catch((error: unknown) => {
  console.error('Không thể khởi động ZuniBee API:', error);
  process.exit(1);
});
