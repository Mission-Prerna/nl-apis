import { CacheModule, CacheStore, Module } from '@nestjs/common';
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
import { PrismaHealthIndicator } from './prisma.health';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health';
import { FusionauthService } from './fusionauth.service';
import { redisStore } from 'cache-manager-redis-store';
import { RedisHelperService } from './RedisHelper.service';
import { SchoolController } from './school/school.controller';
import { SchoolService } from './school/school.service';
import { EtagModule } from './modules/etag/etag.module';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

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
          config: [
            {
              host: config.get('CACHE_HOST'),
              port: config.get('CACHE_PORT'),
            },
          ],
        };
      },
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: (await redisStore({
          url: `redis://${configService.get('CACHE_HOST')}:${configService.get('CACHE_PORT')}`,
        })) as unknown as CacheStore,
      }),
      inject: [ConfigService],
    }),
    TerminusModule,
    EtagModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        fallbackLanguage: configService.get<string>('FALLBACK_LANGUAGE', 'en'),
        loaderOptions: {
          path: path.join(__dirname, '/i18n/'),
          watch: true,
        },
      }),
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang']),
      ],
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{
      ttl: process.env?.RATE_LIMIT_TTL ? parseInt(process.env.RATE_LIMIT_TTL) : 60000, // in milliseconds
      limit: process.env?.RATE_LIMIT ? parseInt(process.env.RATE_LIMIT) : 50,
    }]),
  ],
  controllers: [AppController, SchoolController, AdminController],
  providers: [
    AppService,
    PrismaService,
    AssessmentVisitResultsProcessor,
    AssessmentSurveyResultProcessor,
    PrismaHealthIndicator,
    RedisHealthIndicator,
    FusionauthService,
    RedisHelperService,
    SchoolService,
    AdminService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
