import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers, ParseArrayPipe, Patch,
  Post,
  Query,
  SetMetadata, UnauthorizedException,
  UseGuards, UseInterceptors,
  Put, NotImplementedException, Param,
  ParseIntPipe
} from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/auth-jwt.guard';
import { CreateAssessmentVisitResult } from './dto/CreateAssessmentVisitResult.dto';
import { JwtService } from '@nestjs/jwt';
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
import { SchoolGeofencingBlacklistDto } from './dto/SchoolGeofencingBlacklistDto';
import { GetAssessmentVisitResultsDto } from './dto/GetAssessmentVisitResults.dto';
import { UpsertMentorTokenDto } from './dto/UpsertMentorToken.dto';
import { CreateBotTelemetryDto } from './dto/CreateBotTelemetry.dto';
import { GetMentorBotsWithActionDto } from './dto/GetMentorBotsWithAction.dto';

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
    const decodedAuthTokenData = this.checkTokenIfInvalid(authorizationHeader, false);

    // We'll check if the token is from the very same application as needed in the app
    if (decodedAuthTokenData && decodedAuthTokenData?.applicationId !== this.configService.get<string>('FA_APPLICATION_ID')) {
      throw new BadRequestException('Token is invalid!');
    }

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


  @Get('/api/mentor/details')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getMentorDetails(
    @Query() queryParams: GetMentorDetailsDto,
    @Headers('authorization') authToken: string,
  ) {
    const mentor = await this.getLoggedInMentor(authToken);
    return this.appService.getMentorDetails(
      mentor,
      queryParams.month,
      queryParams.year,
    );
  }

  @Get('/api/metadata')
  async getMetadata() {
    return this.appService.getMetadata();
  }

  @Patch('/api/mentor/pin')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async setMentorPin(
    @Body() body: UpdateMentorPinDto,
    @Headers('authorization') authToken: string,
  ) {
    const mentor: Mentor = await this.getLoggedInMentor(authToken);
    this.appService.updateMentorPin(mentor, body.pin).then(() => true);
    return mentor;
  }

  @Get('/api/actor/dashboard-overview')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getActorHomeScreenMetric(
    @Param() id: number,
    @Headers('authorization') authToken: string,
  ) {
    const mentor = await this.getLoggedInMentor(authToken);
    switch (mentor.actor_id) {
      case ActorEnum.TEACHER:
        break;
      default:
        throw new NotImplementedException('Only Teachers are allowed to access this endpoint.')
    }
    return this.appService.getTeacherHomeScreenMetric(mentor);
  }

  private checkTokenIfInvalid(authToken: string, admin: boolean = false): any {
    const decodedAuthTokenData = <Record<string, any>>(
      this.jwtService.decode(authToken.split(' ')[1])
    );

    // We'll check if the token is from the very same application as needed in the app
    const applicationId = admin ? this.configService.get<string>('FA_ADMIN_APPLICATION_ID') : this.configService.get<string>('FA_APPLICATION_ID');
    if (decodedAuthTokenData && decodedAuthTokenData?.applicationId !== applicationId) {
      throw new UnauthorizedException('Token is invalid!');
    }

    return decodedAuthTokenData;
  }

  @Post('/api/mentor')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard)
  async createMentor(
    @Body() body: CreateMentorDto,
    @Headers('authorization') authToken: string,
  ) {
    this.checkTokenIfInvalid(authToken, true);
    return this.appService.createMentor(body);
  }

  @Post('/api/mentor/old')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard)
  async createMentorOld(
    @Body() body: CreateMentorOldDto,
    @Headers('authorization') authToken: string,
  ) {
    this.checkTokenIfInvalid(authToken, true);
    return this.appService.createMentorOld(body);
  }

  @Post('/admin/school/geo-fencing')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard)
  async schoolGeofencingBlacklist(
    @Body() body: SchoolGeofencingBlacklistDto,
    @Headers('authorization') authToken: string,
  ) {
    this.checkTokenIfInvalid(authToken, true);
    return this.appService.schoolGeofencingBlacklist(body);
  }

  @Get('/admin/assessment-visit-results')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard)
  async getAssessmentVisitResults(
    @Query() queryParams: GetAssessmentVisitResultsDto,
    @Headers('authorization') authToken: string,
  ) {
    this.checkTokenIfInvalid(authToken, true);
    return this.appService.getAssessmentVisitResults(queryParams);
  }

  @Put('/api/mentor/token')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async setMentorToken(
    @Body() body: UpsertMentorTokenDto,
    @Headers('authorization') authToken: string,
  ) {
    const mentor: Mentor = await this.getLoggedInMentor(authToken);
    this.appService.upsertMentorToken(mentor, body.token).then(r => true);
    return {
      msg: 'Success!',
      data: "Token upserted successfully",
    };
  }

  @Post('/api/mentor/bot/telemetry')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async setMentorBotTelemetry(
    @Body() body: CreateBotTelemetryDto,
    @Headers('authorization') authToken: string,
  ) {
    const mentor: Mentor = await this.getLoggedInMentor(authToken);
    await this.appService.setMentorBotTelemetry(mentor.id, body.botId, body.action);
    return {
      msg: 'Success!',
      data: "Telemetry inserted",
    };
  }

  @Get('/api/mentor/bot/telemetry')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getMentorBotsWithAction(
    @Headers('authorization') authToken: string,
    @Query() query: GetMentorBotsWithActionDto
  ) {
    const mentor: Mentor = await this.getLoggedInMentor(authToken);
    return this.appService.getMentorBotsWithAction(mentor.id, query.action)
      .then((response: Array<any>) => response.map(element => element.bot_id));
  }

  @Get('/api/school/:udise/students')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolStudents(
    @Headers('authorization') authToken: string,
    @Param('udise') udise: string
  ) {
    const mentor: Mentor = await this.getLoggedInMentor(authToken);
    return [
      {
        "id": "1",
        "name": "Abhishek 1",
        "grade": 1
      },
      {
        "id": "2",
        "name": "Charanpreet 1",
        "grade": 1
      },
      {
        "id": "3",
        "name": "Chakshu 1",
        "grade": 1
      },
      {
        "id": "4",
        "name": "Suresh 1",
        "grade": 1
      },
      {
        "id": "5",
        "name": "Karan 1",
        "grade": 1
      },
      {
        "id": "6",
        "name": "Abhishek 2",
        "grade": 2
      },
      {
        "id": "7",
        "name": "Charanpreet 2",
        "grade": 2
      },
      {
        "id": "8",
        "name": "Chakshu 2",
        "grade": 2
      },
      {
        "id": "9",
        "name": "Suresh 2",
        "grade": 2
      },
      {
        "id": "10",
        "name": "Ujjwal 2",
        "grade": 2
      },
      {
        "id": "11",
        "name": "Abhishek 3",
        "grade": 3
      },
      {
        "id": "12",
        "name": "Charanpreet 3",
        "grade": 3
      },
      {
        "id": "13",
        "name": "Chakshu 3",
        "grade": 3
      },
      {
        "id": "14",
        "name": "Suresh 3",
        "grade": 3
      },
      {
        "id": "15",
        "name": "Ujjwal 3",
        "grade": 3
      }
    ];
  }

  @Get('/api/school/:udise/students/result')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolStudentsResults(
    @Headers('authorization') authToken: string,
    @Param('udise') udise: string,
    @Query('grade', new ParseArrayPipe({ items: Number, separator: ',' })) grades: number[],
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    const mentor: Mentor = await this.getLoggedInMentor(authToken);
    return [
      {
        "grade": grades[0],
        "period": month + " " + year,
        "summary": [
          {
            "label": "Total",
            "colour": "#FF0000",
            "count": 4
          },
          {
            "label": "Nipun",
            "colour": "#FFFFFF",
            "count": 2
          },
          {
            "label": "Not accessed",
            "colour": "#000000",
            "count": 2
          }
        ],
        "students": [
          {
            "id": "1",
            "status": "pass",
            "last_assessment_date": 170123456876
          },
          {
            "id": "2",
            "status": "fail",
            "last_assessment_date": 170123456876
          },
          {
            "id": "3",
            "status": "pending",
            "last_assessment_date": 170123456876
          }
        ]
      }
    ];
  }

  @Get('/api/school/:udise/students/result/summary')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolStudentsResultsSummary(
    @Headers('authorization') authToken: string,
    @Param('udise') udise: string,
    @Query('grade', new ParseArrayPipe({ items: Number, separator: ',' })) grades: number[]
  ) {
    const mentor: Mentor = await this.getLoggedInMentor(authToken);
    return [
      {
        "grade": grades[0],
        "summary": [
          {
            "period": "August",
            "total": 15,
            "assessed": 10,
            "successful": 5
          },
          {
            "period": "July",
            "total": 15,
            "assessed": 8,
            "successful": 4
          }
        ]
      }
    ];
  }

  @Get('/api/school/:udise/teacher/performance/insights')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolTeacherPerformance(
    @Headers('authorization') authToken: string,
    @Param('udise') udise: string,
  ) {
    const mentor: Mentor = await this.getLoggedInMentor(authToken);
    return [
      {
        "period": "Saptahik",
        "insights": [
          {
            "label": "Total students",
            "count": "15"
          },
          {
            "label": "Assessed students",
            "count": "10"
          }
        ]
      },
      {
        "period": "August",
        "insights": [
          {
            "label": "Total students",
            "count": "15"
          },
          {
            "label": "Assessed students",
            "count": "5"
          }
        ]
      }
    ]
  }

  @Post('/admin/queues/pause')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard)
  async pauseQueues(
    @Headers('authorization') authToken: string,
  ) {
    this.checkTokenIfInvalid(authToken, true);
    await Promise.all([
      this.assessmentVisitResultQueue.pause(false),
      this.assessmentSurveyResultQueue.pause(false),
    ]);
    return 'ok';
  }

  @Post('/admin/queues/resume')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard)
  async resumeQueues(
    @Headers('authorization') authToken: string,
  ) {
    this.checkTokenIfInvalid(authToken, true);
    await Promise.all([
      this.assessmentVisitResultQueue.resume(false),
      this.assessmentSurveyResultQueue.resume(false),
    ]);
    return 'ok';
  }

  @Get('/admin/queues/count')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard)
  async countQueues(
    @Headers('authorization') authToken: string,
  ) {
    this.checkTokenIfInvalid(authToken, true);
    return {
      assessment_visit_results: await this.assessmentVisitResultQueue.count(),
      assessment_survey_results: await this.assessmentSurveyResultQueue.count(),
    };
  }

  @Get('/admin/queues/failed-count')
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard)
  async countFailedQueues(
    @Headers('authorization') authToken: string,
  ) {
    this.checkTokenIfInvalid(authToken, true);
    return {
      assessment_visit_results: await this.assessmentVisitResultQueue.getFailedCount(),
      assessment_survey_results: await this.assessmentSurveyResultQueue.getFailedCount(),
    };
  }
}
