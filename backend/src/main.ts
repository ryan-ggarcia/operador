import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

/** Configuração HTTP comum ao app e aos testes e2e. */
export function configureApp(app: Awaited<ReturnType<typeof NestFactory.create>>) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.enableShutdownHooks();
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // req.ip vem do X-Forwarded-For só quando a conexão chega da própria máquina
  // ou da rede privada (o Caddy, na rede do Docker); IP público não forja.
  app.set('trust proxy', 'loopback, uniquelocal');
  configureApp(app);
  await app.listen(process.env.PORT ?? 3001);
}

if (process.env.NODE_ENV !== 'test') await bootstrap();
