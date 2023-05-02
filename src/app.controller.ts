import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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
import { JobEnum, Mentor, QueueEnum } from './enums';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly jwtService: JwtService,
    @InjectQueue(QueueEnum.AssessmentVisitResults) private readonly assessmentVisitResultQueue: Queue,
    @InjectQueue(QueueEnum.AssessmentSurveyResult) private readonly assessmentSurveyResultQueue: Queue,
  ) {}

  @Get('/health')
  getHealth(): string {
    return 'Ok';
  }

  private async getLoggedInMentor(
    authorizationHeader: string,
  ): Promise<Mentor> {
    const decodedAuthTokenData = <Record<string, any>>(
      this.jwtService.decode(authorizationHeader.split(' ')[1])
    );

    // TODO add caching here
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

  @Roles('Admin', 'OpenRole', 'DIET')
  @UseGuards(JwtAuthGuard)
  @Post('/api/assessment-visit-results')
  async createAssessmentVisitResults(
    @Body() createAssessmentVisitResultDto: CreateAssessmentVisitResult,
    @Headers('authorization') authToken: string,
    @Query('useQueue') useQueue: number,
  ) {
    createAssessmentVisitResultDto.mentor_id = Number(
      (await this.getLoggedInMentor(authToken)).id,
    ); // assign mentor_id for logged in user
    if (isNaN(useQueue) || useQueue) {
      await this.assessmentVisitResultQueue.add(JobEnum.CreateAssessmentVisitResults, createAssessmentVisitResultDto, {
        attempts: 3,
        removeOnComplete: true,
      });
      return {
        msg: "Queued!"
      };
    } else {
      return await this.appService.createAssessmentVisitResult(createAssessmentVisitResultDto);
    }
  }

  @Get('/api/mentor/schools')
  @Roles('Admin', 'OpenRole', 'DIET')
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
  @Roles('Admin', 'OpenRole', 'DIET')
  @UseGuards(JwtAuthGuard)
  async createAssessmentSurveyResult(
    @Body() assessmentSurveyResult: CreateAssessmentSurveyResult,
    @Headers('authorization') authToken: string,
    @Query('useQueue') useQueue: number,
  ) {
    assessmentSurveyResult.mentor_id = Number(
      (await this.getLoggedInMentor(authToken)).id,
    ); // assign mentor_id for logged in user

    if (isNaN(useQueue) || useQueue) {
      await this.assessmentSurveyResultQueue.add(JobEnum.CreateAssessmentSurveyResult, assessmentSurveyResult, {
        attempts: 3,
        removeOnComplete: true,
      });
      return {
        msg: "Queued!"
      };
    } else {
      return await this.appService.createAssessmentSurveyResult(assessmentSurveyResult);
    }
  }

  @Get('/api/mentor/dashboard-overview')
  @Roles('Admin', 'OpenRole', 'DIET')
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
