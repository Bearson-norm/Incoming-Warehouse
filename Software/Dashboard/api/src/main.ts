import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { bootstrapDatabase } from './database/database-bootstrap';
import { assertRuntimeSecrets } from './common/runtime-secrets';

async function bootstrap() {
  assertRuntimeSecrets();
  await bootstrapDatabase();
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const allowedOrigins = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
    : true;
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new PrismaExceptionFilter());

  app.setGlobalPrefix('api');

  app.getHttpAdapter().get('/', (req, res) => {
    res.json({
      message: 'Incoming Warehouse API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth/login',
        vendors: '/api/vendors',
        packagings: '/api/packagings',
        sessions: '/api/sessions',
        readings: '/api/readings',
        weighings: '/api/weighings/confirm',
        rmCodes: '/api/rm-codes',
      },
      documentation: 'All API endpoints are prefixed with /api',
    });
  });

  const port = process.env.PORT || 4123;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
