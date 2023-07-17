import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { AssessmentVisitResultsProcessor } from './processors/assessment-visit-results.processor';
import { AssessmentSurveyResultProcessor } from './processors/assessment-survey-result.processor';
import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { BullModule } from '@nestjs/bull';
import { QueueEnum } from './enums';
import { AuthModule } from './auth/auth.module';
import { JwtModule } from '@nestjs/jwt';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
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
          imports: [ConfigModule],
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
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should be defined', () => {
      expect(appController.getHealth).toBeDefined();
    });
  });
});
