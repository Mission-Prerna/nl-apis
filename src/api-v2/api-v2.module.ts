import { Module } from '@nestjs/common';
import { V2Controller } from './v2.controller';
import { V2Service } from './v2.service';
import { PrismaService } from '../prisma.service';
import { FusionauthService } from '../fusionauth.service';
import { RedisHelperService } from '../RedisHelper.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule],
  controllers: [V2Controller],
  providers: [
    V2Service,
    // AppService,
    PrismaService,
    // AssessmentVisitResultsProcessor,
    // AssessmentSurveyResultProcessor,
    // PrismaHealthIndicator,
    // RedisHealthIndicator,
    FusionauthService,
    RedisHelperService,
  ]
})
export class ApiV2Module {}
