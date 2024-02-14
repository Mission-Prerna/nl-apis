import {
  Body,
  Controller,
  Get,
  NotImplementedException,
  Param,
  ParseArrayPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  SetMetadata,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/auth-jwt.guard';
import { CreateAssessmentVisitResult } from './dto/CreateAssessmentVisitResult.dto';
import { GetMentorSchoolList } from './dto/GetMentorSchoolList.dto';
import { CreateAssessmentSurveyResult } from './dto/CreateAssessmentSurveyResult.dto';
import { GetHomeScreenMetric } from './dto/GetHomeScreenMetric.dto';
import { ActorEnum, JobEnum, Mentor, QueueEnum, Role } from './enums';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';
import { GetMentorDetailsDto } from './dto/GetMentorDetails.dto';
import { UpdateMentorPinDto } from './dto/UpdateMentorPin.dto';
import { SentryInterceptor } from './interceptors/sentry.interceptor';
import { CreateMentorDto } from './dto/CreateMentor.dto';
import { CreateMentorOldDto } from './dto/CreateMentorOld.dto';
import { UpsertMentorTokenDto } from './dto/UpsertMentorToken.dto';
import { CreateBotTelemetryDto } from './dto/CreateBotTelemetry.dto';
import { GetMentorBotsWithActionDto } from './dto/GetMentorBotsWithAction.dto';
import { JwtAdminGuard } from './auth/admin-jwt.guard';
import { MentorInterceptor } from './interceptors/mentor.interceptor';
import { AdminService } from './admin/admin.service';
import { AssessmentCycleValidatorDto } from './dto/AssessmentCycleValidator.dto';
import { CreateMentorSegmentRequest } from './dto/CreateMentorSegmentRequest.dto';
import { GetAppActionsDto } from './dto/AppActions.dto';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller()
@UseInterceptors(SentryInterceptor)
export class AppController {
  private readonly useQueues: boolean;
  constructor(
    private healthCheckService: HealthCheckService,
    private prismaIndicator: PrismaHealthIndicator,
    private redisIndicator: RedisHealthIndicator,
    @InjectRedis() private readonly redis: Redis,
    private readonly appService: AppService,
    private readonly configService: ConfigService,
    @InjectQueue(QueueEnum.AssessmentVisitResults)
    private readonly assessmentVisitResultQueue: Queue,
    @InjectQueue(QueueEnum.AssessmentSurveyResult)
    private readonly assessmentSurveyResultQueue: Queue,
    private readonly adminService: AdminService,
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

  @Post('/api/assessment-visit-results')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async createAssessmentVisitResults(
    @Body(new ParseArrayPipe({ items: CreateAssessmentVisitResult })) body: CreateAssessmentVisitResult[],
    @Request() { mentorId }: { mentorId: number },
  ) {
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
  @UseInterceptors(MentorInterceptor)
  async getMentorSchoolList(
    @Query() queryParams: GetMentorSchoolList,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.appService.getMentorSchoolListIfHeHasVisited(
      mentor,
      queryParams.month,
      queryParams.year,
    );
  }

  @Post('/api/assessment-survey-results')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async createAssessmentSurveyResult(
    @Body(new ParseArrayPipe({ items: CreateAssessmentSurveyResult })) body: CreateAssessmentSurveyResult[],
    @Request() { mentorId }: { mentorId: number },
  ) {
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
        dto.mentor_id = mentorId; // assign logged in mentor to dto
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
  @UseInterceptors(MentorInterceptor)
  async getHomeScreenMetric(
    @Query() queryParams: GetHomeScreenMetric,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.appService.getHomeScreenMetric(
      mentor,
      queryParams.month,
      queryParams.year,
    );
  }


  @Get('/api/mentor/details')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getMentorDetails(
    @Query() queryParams: GetMentorDetailsDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.appService.getMentorDetails(
      mentor,
      queryParams.month,
      queryParams.year,
    );
  }

  @Get('/api/v2/mentor/details')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getMentorDetailsV2(
    @Query() queryParams: GetMentorDetailsDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.appService.getMentorDetailsV2(
      mentor,
      queryParams.month,
      queryParams.year,
    );
  }

  @Get('/api/actions')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getMentorActionDetails(
    @Query() queryParams: GetAppActionsDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.appService.getAppActionsForMentor(mentor, queryParams.timestamp);
  }

  @Get('/api/metadata')
  async getMetadata() {
    return this.appService.getMetadata();
  }

  @Patch('/api/mentor/pin')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async setMentorPin(
    @Body() body: UpdateMentorPinDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    this.appService.updateMentorPin(mentor, body.pin).then(() => true);
    return mentor;
  }

  @Get('/api/actor/dashboard-overview')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getActorHomeScreenMetric(
    @Param() id: number,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    switch (mentor.actor_id) {
      case ActorEnum.TEACHER:
        break;
      default:
        throw new NotImplementedException('Only Teachers are allowed to access this endpoint.')
    }
    return this.appService.getTeacherHomeScreenMetric(mentor);
  }

  @Post(['/api/mentor'])
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async createMentor(
    @Body() body: CreateMentorDto,
  ) {
    return this.adminService.createMentor(body);
  }

  @Post(['/api/mentor/segment'])
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async createMentorSegment(
    @Body() body: CreateMentorSegmentRequest,
  ) {
    return this.adminService.createMentorSegment(body);
  }

  @Post(['/api/mentor/old'])
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async createMentorOld(
    @Body() body: CreateMentorOldDto,
  ) {
    return this.adminService.createMentorOld(body);
  }

  @Post('/api/mentor/token')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async setMentorToken(
    @Body() body: UpsertMentorTokenDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    this.appService.upsertMentorToken(mentor, body.token).then(() => true);
    return {
      msg: 'Success!',
      data: "Token upserted successfully",
    };
  }

  @Put('/api/mentor/token')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async setMentorTokenPut(
    @Body() body: UpsertMentorTokenDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    this.appService.upsertMentorToken(mentor, body.token).then(() => true);
    return {
      msg: 'Success!',
      data: "Token upserted successfully",
    };
  }

  @Post('/api/mentor/bot/telemetry')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async setMentorBotTelemetry(
    @Body() body: CreateBotTelemetryDto[],
    @Request() { mentor }: { mentor: Mentor },
  ) {
    this.appService.setMentorBotTelemetry(mentor.id, body);
    return {
      msg: 'Success!',
      data: "Telemetry inserted",
    };
  }

  @Get('/api/mentor/bot/telemetry')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getMentorBotsWithAction(
    @Query() query: GetMentorBotsWithActionDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.appService.getMentorBotsWithAction(mentor.id, query.action)
      .then((response: Array<any>) => response.map(element => element.bot_id));
  }

  @Get('/api/mentor/bot')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getMentorBots(
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.appService.getMentorBots(mentor.id);
  }


  @Get('/api/examiner/performance/insights')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getExaminerPerformanceInsights(
    @Query() params: AssessmentCycleValidatorDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    if (mentor.actor_id != ActorEnum.EXAMINER) {
      throw new NotImplementedException('Only Examiners are allowed to access this endpoint.');
    }
    return this.appService.getExaminerHomeScreenMetric(mentor, params.cycle_id);
  }
}
