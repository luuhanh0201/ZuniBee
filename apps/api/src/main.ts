import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { UPLOAD_ROOT } from '@/modules/upload-file/upload-file.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  const port = configService.get<number>('APP_PORT', 2222);
  const prefix = configService.get<string>('APP_PREFIX', 'api/v1');
  const webUrl = configService.get<string>('WEB_URL', 'http://localhost:1111');
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.setGlobalPrefix(prefix);
  if (isProduction) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'none'"],
              formAction: ["'none'"],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.useStaticAssets(UPLOAD_ROOT, { prefix: '/uploads/' });
  app.use(cookieParser());

  app.enableCors({
    origin: webUrl,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Guest-Token',
    ],
    maxAge: 600,
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

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ZuniBee API')
      .setDescription('API documentation for ZuniBee')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument);
  }

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
