import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as Sentry from '@sentry/node';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SWAGGER_CONSTANTS, SWAGGER_TAGS } from './utils/constants';

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
    new FastifyAdapter({ bodyLimit: 1024 * 1024 * 20 }),
  );

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Configure Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      SWAGGER_CONSTANTS.SWAGGER_AUTH_SECURITY_SCHEMA_JWT, // Bearer token security scheme name
    )
    .setTitle(SWAGGER_CONSTANTS.TITLE)
    .setDescription(SWAGGER_CONSTANTS.DESCRIPTION)
    .setVersion(SWAGGER_CONSTANTS.VERSION)
    .addTag(SWAGGER_TAGS.DEFAULT) // Add a tag for API grouping
    .build();

  // Create the Swagger document
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  // Setup Swagger UI endpoint for API documentation
  SwaggerModule.setup(SWAGGER_CONSTANTS.PATH, app, swaggerDocument, {
    swaggerOptions: {
      tagsSorter: 'alpha', // Sort tags alphabetically
      operationsSorter: 'alpha', // Sort operations alphabetically within tags
      docExpansion: 'none', // Collapse all documentation sections by default
    },
  });

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });

  await app.listen(3000, '0.0.0.0',() => {
    console.log(
      `
             🔌 NL APIs ready at http://localhost:3000

             💻 Swagger UI ready at at http://localhost:3000/${SWAGGER_CONSTANTS.PATH}
      `,
    );
  });
}
bootstrap();
