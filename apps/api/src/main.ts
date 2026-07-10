import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const port = configService.get<number>('APP_PORT', 4000);
  const prefix = configService.get<string>('APP_PREFIX', 'api/v1');
  const webUrl = configService.get<string>('WEB_URL', 'http://localhost:3000');

  app.setGlobalPrefix(prefix);

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

  console.log(`ZuniBee API: http://localhost:${port}/${prefix}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
}

bootstrap();
