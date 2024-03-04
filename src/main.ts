import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as Sentry from '@sentry/node';
import fastifyMultipart from '@fastify/multipart';

// javascript does not know how to stringify BigInt
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: implicit any type
BigInt.prototype['toJSON'] = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // Payload upto 20mib
    new FastifyAdapter({ bodyLimit: 1024 * 1024 * 20})
  );

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  app.register(fastifyMultipart)

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
