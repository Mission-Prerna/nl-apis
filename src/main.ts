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
    // Fastify adapter with payload limit of 20MB
    new FastifyAdapter({ bodyLimit: 1024 * 1024 * 20 })
  );

  app.enableCors();
  await app.register(fastifyMultipart);

  // Enable NestJS graceful shutdown hooks
  app.enableShutdownHooks();

  // Use global validation pipe for transforming and validating inputs
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Initialize Sentry for error tracking
  Sentry.init({
    dsn: process.env.SENTRY_DSN, // Make sure SENTRY_DSN is correctly set in your .env file
    tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
  });

  // Gracefully handle termination signals
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    app.close(); // Ensure Fastify's app shutdown is handled
    process.exit(0); // Exit gracefully after app.close() completes
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received (Ctrl+C), shutting down gracefully...');
    app.close(); // Ensure Fastify's app shutdown is handled
    process.exit(0); // Exit gracefully after app.close() completes
  });

  // Start the application and listen on all network interfaces at port 3000
  await app.listen(3000, '0.0.0.0');
}

bootstrap();
