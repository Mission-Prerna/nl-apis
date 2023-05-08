import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers, ParseArrayPipe,
  Post,
  Query,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/auth-jwt.guard';
import { CreateAssessmentVisitResult } from './dto/CreateAssessmentVisitResult.dto';
import { JwtService } from '@nestjs/jwt';
import { GetMentorSchoolList } from './dto/GetMentorSchoolList.dto';
import { CreateAssessmentSurveyResult } from './dto/CreateAssessmentSurveyResult.dto';
import { GetHomeScreenMetric } from './dto/GetHomeScreenMetric.dto';
import { JobEnum, Mentor, QueueEnum, Role } from './enums';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller()
export class AppController {
  private readonly useQueues: boolean;
  constructor(
    private healthCheckService: HealthCheckService,
    private prismaIndicator: PrismaHealthIndicator,
    private redisIndicator: RedisHealthIndicator,
    @InjectRedis() private readonly redis: Redis,
    private readonly appService: AppService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectQueue(QueueEnum.AssessmentVisitResults)
    private readonly assessmentVisitResultQueue: Queue,
    @InjectQueue(QueueEnum.AssessmentSurveyResult)
    private readonly assessmentSurveyResultQueue: Queue,
  ) {
    this.useQueues =
      configService.get<string>('API_QUEUES', 'false') === 'true';
  }

  @Get('/health')
  @HealthCheck()
  async getHealth() {
    return this.healthCheckService.check([
      async () =>
        this.redisIndicator.checkHealth('Redis', {
          type: 'redis',
          client: this.redis,
          timeout: 500,
        }),
      async () => this.prismaIndicator.isHealthy('Db'),
    ]);
  }

  private async getLoggedInMentor(
    authorizationHeader: string,
  ): Promise<Mentor> {
    const decodedAuthTokenData = <Record<string, any>>(
      this.jwtService.decode(authorizationHeader.split(' ')[1])
    );

    const mentor = await this.appService.findMentorByPhoneNumber(
      decodedAuthTokenData?.['https://hasura.io/jwt/claims']?.[
        'X-Hasura-User-Id'
      ],
    );

    if (!mentor) {
      throw new BadRequestException('User is invalid!');
    }

    return mentor;
  }

  @Post('/api/assessment-visit-results')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async createAssessmentVisitResults(
    @Body(new ParseArrayPipe({ items: CreateAssessmentVisitResult })) body: CreateAssessmentVisitResult[],
    @Headers('authorization') authToken: string,
  ) {
    const mentorId = Number(
      (await this.getLoggedInMentor(authToken)).id,
    );
    if (!Array.isArray(body)) {
      // if body is not an array, we make it an iterable array
      body = [body];
    }
    if (this.useQueues) {
      for (const dto of body) { // iterate over objects & push to queue
        dto.mentor_id = mentorId; // assign logged in mentor to dto
        await this.assessmentVisitResultQueue.add(
          JobEnum.CreateAssessmentVisitResults,
          dto,
          {
            attempts: 3,
            removeOnComplete: true,
            backoff: 60000,
          },
        );
      }
      return {
        msg: 'Queued!',
        data: null,
      };
    } else {
      const response = [];
      for (const dto of body) { // iterate over objects & push to DB
        dto.mentor_id = mentorId; // assign logged in mentor to dto
        response.push(await this.appService.createAssessmentVisitResult(dto));
      }
      return {
        msg: 'Success!',
        data: response,
      };
    }
  }

  @Get('/api/mentor/schools')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getMentorSchoolList(
    @Query() queryParams: GetMentorSchoolList,
    @Headers('authorization') authToken: string,
  ) {
    const mentor = await this.getLoggedInMentor(authToken);
    return this.appService.getMentorSchoolListIfHeHasVisited(
      mentor,
      queryParams.month,
      queryParams.year,
    );
  }

  @Post('/api/assessment-survey-results')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async createAssessmentSurveyResult(
    @Body(new ParseArrayPipe({ items: CreateAssessmentSurveyResult })) body: CreateAssessmentSurveyResult[],
    @Headers('authorization') authToken: string,
  ) {
    const mentorId = Number(
      (await this.getLoggedInMentor(authToken)).id,
    );
    if (!Array.isArray(body)) {
      // if body is not an array, we make it an iterable array
      body = [body];
    }
    if (this.useQueues) {
      for (const dto of body) { // iterate over objects & push to queue
        dto.mentor_id = mentorId; // assign logged in mentor to dto
        await this.assessmentSurveyResultQueue.add(
          JobEnum.CreateAssessmentSurveyResult,
          dto,
          {
            attempts: 3,
            removeOnComplete: true,
            backoff: 60000
          },
        );
      }
      return {
        msg: 'Queued!',
        data: null
      };
    } else {
      const response = [];
      for (const dto of body) {
        response.push(await this.appService.createAssessmentSurveyResult(dto));
      }
      return {
        msg: 'Success!',
        data: response,
      };
    }
  }

  @Get('/api/mentor/dashboard-overview')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getHomeScreenMetric(
    @Query() queryParams: GetHomeScreenMetric,
    @Headers('authorization') authToken: string,
  ) {
    const mentor = await this.getLoggedInMentor(authToken);
    return this.appService.getHomeScreenMetric(
      mentor,
      queryParams.month,
      queryParams.year,
    );
  }
}
