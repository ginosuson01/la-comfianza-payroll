import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  const port = config.getOrThrow<number>('API_PORT');

  const webOrigin = config.getOrThrow<string>('WEB_ORIGIN');

  // Security headers must be registered early.
  app.use(helmet());

  app.enableCors({
    origin: webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const httpAdapterHost = app.get(HttpAdapterHost);

  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  Logger.log(`API running at http://localhost:${port}/api/v1`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start API:', error);

  process.exit(1);
});
