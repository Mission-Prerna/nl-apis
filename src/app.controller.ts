import {
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
import { Mentor } from './enums';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly jwtService: JwtService,
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
    return this.appService.findMentorByPhoneNumber(
      decodedAuthTokenData['https://hasura.io/jwt/claims']['X-Hasura-User-Id'],
    );
  }

  @Roles('Admin', 'OpenRole')
  @UseGuards(JwtAuthGuard)
  @Post('/api/assessment-visit-results')
  async createAssessmentVisitResults(
    @Body() createAssessmentVisitResultDto: CreateAssessmentVisitResult,
    @Headers('authorization') authToken: string,
  ) {
    createAssessmentVisitResultDto.mentor_id = Number(
      (await this.getLoggedInMentor(authToken)).id,
    ); // assign mentor_id for logged in user
    return await this.appService.createAssessmentVisitResult(
      createAssessmentVisitResultDto,
    );
  }

  @Get('/api/mentor/schools')
  @Roles('Admin', 'OpenRole')
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
  @Roles('Admin', 'OpenRole')
  @UseGuards(JwtAuthGuard)
  async createAssessmentSurveyResult(
    @Body() assessmentSurveyResult: CreateAssessmentSurveyResult,
    @Headers('authorization') authToken: string,
  ) {
    assessmentSurveyResult.mentor_id = Number(
      (await this.getLoggedInMentor(authToken)).id,
    ); // assign mentor_id for logged in user
    return await this.appService.createAssessmentSurveyResult(
      assessmentSurveyResult,
    );
  }

  @Get('/api/mentor/dashboard-overview')
  @Roles('Admin', 'OpenRole')
  @UseGuards(JwtAuthGuard)
  getHomeScreenMetric(
    @Query() queryParams: GetHomeScreenMetric,
    @Headers('authorization') authToken: string,
  ) {
    const decodedAuthTokenData = <Record<string, any>>(
      this.jwtService.decode(authToken.split(' ')[1])
    );

    const mentorPhoneNumber =
      decodedAuthTokenData['https://hasura.io/jwt/claims']['X-Hasura-User-Id'];

    return this.appService.getHomeScreenMetric(
      mentorPhoneNumber,
      queryParams.month,
      queryParams.year,
    );
  }
}
