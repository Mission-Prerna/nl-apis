import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { AssessmentVisitResultsProcessor } from './processors/assessment-visit-results.processor';
import { AssessmentSurveyResultProcessor } from './processors/assessment-survey-result.processor';
import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health';
import { RedisModule, RedisService } from '@liaoliaots/nestjs-redis';
import { BullModule } from '@nestjs/bull';
import { QueueEnum } from './enums';
import { AuthModule } from './auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { FusionauthService } from './fusionauth.service';
import { RedisHelperService } from './RedisHelper.service';

class MockRedisService {
  getClient(): Promise<any> {
    return Promise.resolve();
  }
}

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        AuthModule,
        JwtModule,
        BullModule.forRoot({}),
        BullModule.registerQueue(
          {
            name: QueueEnum.AssessmentVisitResults,
          },
          {
            name: QueueEnum.AssessmentSurveyResult,
          },
        ),
        CacheModule.register(),
        RedisModule.forRoot({config: {}}),
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
        FusionauthService,
        RedisHelperService,
        RedisService,
        {
          provide: RedisService,
          useClass: MockRedisService
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should be defined', () => {
      expect(appController.getHealth).toBeDefined();
    });
  });

  // Cleanup mocks after each test
  afterEach(() => {
    jest.clearAllMocks();
  });
});
