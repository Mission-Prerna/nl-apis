import { Test, TestingModule } from '@nestjs/testing';
import { SchoolService } from './school.service';
import { PrismaService } from '../prisma.service';
import { AppService } from '../app.service';
import { CacheModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FusionauthService } from '../fusionauth.service';
import { RedisHelperService } from '../RedisHelper.service';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { JwtService } from '@nestjs/jwt';

class MockRedisService {
  getClient(): Promise<any> {
    return Promise.resolve();
  }
}

describe('SchoolService', () => {
  let service: SchoolService;
  let prismaService: PrismaService;
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        ConfigModule
      ],
      providers: [
        SchoolService,
        PrismaService,
        AppService,
        FusionauthService,
        RedisHelperService,
        RedisService,
        {
          provide: RedisService,
          useClass: MockRedisService
        },
        JwtService,
      ],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);
    appService = module.get<AppService>(AppService);
    service = module.get<SchoolService>(SchoolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
