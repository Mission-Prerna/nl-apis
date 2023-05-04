import { CacheModule, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { QueueEnum } from './enums';
import { AssessmentVisitResultsProcessor } from './processors/assessment-visit-results.processor';
import { AssessmentSurveyResultProcessor } from './processors/assessment-survey-result.processor';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaHealthIndicator } from 'prisma/prisma.health';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    JwtModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('QUEUE_HOST'),
          port: configService.get('QUEUE_PORT'),
        },
        /*limiter: {
          max: 2,
          duration: 1000,
        },*/
        prefix: configService.get('ENVIRONMENT', 'local') + ':',
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: QueueEnum.AssessmentVisitResults,
      },
      {
        name: QueueEnum.AssessmentSurveyResult,
      },
    ),
    RedisModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        return {
          config: {
            host: config.get('QUEUE_HOST'),
            port: config.get('QUEUE_PORT'),
          },
        };
      },
      inject: [ConfigService],
    }),
    CacheModule.register({ isGlobal: true }),
    TerminusModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    AssessmentVisitResultsProcessor,
    AssessmentSurveyResultProcessor,
    PrismaHealthIndicator,
    RedisHealthIndicator,
  ],
})
export class AppModule {}
