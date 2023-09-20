import { Test, TestingModule } from '@nestjs/testing';
import { SchoolController } from './school.controller';
import { AppService } from '../app.service';
import { EtagService } from '../modules/etag/etag.service';
import { EtagModule } from '../modules/etag/etag.module';
import { CacheModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { FusionauthService } from '../fusionauth.service';
import { RedisHelperService } from '../RedisHelper.service';
import { JwtModule } from '@nestjs/jwt';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { SchoolService } from './school.service';

class MockRedisService {
  getClient(): Promise<any> {
    return Promise.resolve();
  }
}

describe('SchoolController', () => {
  let controller: SchoolController;
  let appService: AppService;
  let etagService: EtagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        EtagModule,
        ConfigModule,
        JwtModule,
      ],
      controllers: [SchoolController],
      providers: [
        AppService,
        PrismaService,
        FusionauthService,
        RedisHelperService,
        RedisService,
        {
          provide: RedisService,
          useClass: MockRedisService
        },
        SchoolService,
      ]
    }).compile();

    appService = module.get<AppService>(AppService);
    etagService = module.get<EtagService>(EtagService);
    controller = module.get<SchoolController>(SchoolController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
