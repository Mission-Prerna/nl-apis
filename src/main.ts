import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

// javascript does not know how to stringify BigInt
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: implicit any type
BigInt.prototype['toJSON'] = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
