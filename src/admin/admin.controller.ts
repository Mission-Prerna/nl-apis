import {
  Body,
  Controller,
  Delete,
  Get,
  ParseArrayPipe,
  Patch,
  Post,
  Query,
  SetMetadata,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { QueueEnum, Role } from '../enums';
import { JwtAdminGuard } from '../auth/admin-jwt.guard';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CreateMentorDto } from '../dto/CreateMentor.dto';
import { CreateMentorOldDto } from '../dto/CreateMentorOld.dto';
import { SchoolGeofencingBlacklistDto } from '../dto/SchoolGeofencingBlacklistDto';
import { GetAssessmentVisitResultsDto } from '../dto/GetAssessmentVisitResults.dto';
import { CreateStudent } from './dto/CreateStudent';
import { UpdateStudent } from './dto/UpdateStudent';
import { DeleteStudent } from './dto/DeleteStudent';
import { AdminService } from './admin.service';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('/admin')
@UseInterceptors(SentryInterceptor)
export class AdminController {
  constructor(
    private readonly appService: AdminService,
    @InjectQueue(QueueEnum.AssessmentVisitResults)
    private readonly assessmentVisitResultQueue: Queue,
    @InjectQueue(QueueEnum.AssessmentSurveyResult)
    private readonly assessmentSurveyResultQueue: Queue,
  ) {
  }

  @Post(['/mentor'])
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async createMentor(
    @Body() body: CreateMentorDto,
  ) {
    return this.appService.createMentor(body);
  }

  @Post(['/mentor/old'])
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async createMentorOld(
    @Body() body: CreateMentorOldDto,
  ) {
    return this.appService.createMentorOld(body);
  }

  @Post('/school/geo-fencing')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async schoolGeofencingBlacklist(
    @Body() body: SchoolGeofencingBlacklistDto,
  ) {
    return this.appService.schoolGeofencingBlacklist(body);
  }

  @Get('/assessment-visit-results')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async getAssessmentVisitResults(
    @Query() queryParams: GetAssessmentVisitResultsDto,
  ) {
    return this.appService.getAssessmentVisitResults(queryParams);
  }

  @Post('/queues/pause')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async pauseQueues() {
    await Promise.all([
      this.assessmentVisitResultQueue.pause(false),
      this.assessmentSurveyResultQueue.pause(false),
    ]);
    return 'ok';
  }

  @Post('/queues/resume')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async resumeQueues() {
    await Promise.all([
      this.assessmentVisitResultQueue.resume(false),
      this.assessmentSurveyResultQueue.resume(false),
    ]);
    return 'ok';
  }

  @Get('/queues/count')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async countQueues() {
    return {
      assessment_visit_results: await this.assessmentVisitResultQueue.count(),
      assessment_survey_results: await this.assessmentSurveyResultQueue.count(),
    };
  }

  @Get('/queues/failed-count')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async countFailedQueues() {
    return {
      assessment_visit_results: await this.assessmentVisitResultQueue.getFailedCount(),
      assessment_survey_results: await this.assessmentSurveyResultQueue.getFailedCount(),
    };
  }

  @Post('/students')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async createStudents(
    @Body(new ParseArrayPipe({ items: CreateStudent })) body: CreateStudent[],
  ) {
    return body;
  }

  @Patch('/students')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async updateStudents(
    @Body(new ParseArrayPipe({ items: UpdateStudent })) body: UpdateStudent[],
  ) {
    return body;
  }

  @Delete('/students')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async deleteStudents(
    @Body(new ParseArrayPipe({ items: DeleteStudent })) body: DeleteStudent[],
  ) {
    return body;
  }
}
