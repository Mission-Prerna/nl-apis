import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { UpdateStudent } from './dto/UpdateStudent';
import { DeleteStudent } from './dto/DeleteStudent';
import { AdminService } from './admin.service';
import { CreateStudent } from './dto/CreateStudent';
import { MaxItemsPipe } from '../pipes/max-items.pipe';
import { Throttle } from '@nestjs/throttler';
import { CreateAssessmentCycle } from './dto/CreateAssessmentCycle';
import { CreateAssessmentCycleDistrictSchoolMapping } from './dto/CreateAssessmentCycleDistrictSchoolMapping';
import { CycleIdValidateDto } from './dto/CycleIdValidateDto';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('/admin')
@UseInterceptors(SentryInterceptor)
export class AdminController {
  constructor(
    private readonly service: AdminService,
    @InjectQueue(QueueEnum.AssessmentVisitResults)
    private readonly assessmentVisitResultQueue: Queue,
    @InjectQueue(QueueEnum.AssessmentSurveyResult)
    private readonly assessmentSurveyResultQueue: Queue,
  ) {
  }

  @Post(['/mentor'])
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 500, ttl: 60000 } })
  async createMentor(
    @Body() body: CreateMentorDto,
  ) {
    return this.service.createMentor(body);
  }

  @Post(['/mentor/old'])
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 500, ttl: 60000 } })
  async createMentorOld(
    @Body() body: CreateMentorOldDto,
  ) {
    return this.service.createMentorOld(body);
  }

  @Post('/school/geo-fencing')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async schoolGeofencingBlacklist(
    @Body() body: SchoolGeofencingBlacklistDto,
  ) {
    return this.service.schoolGeofencingBlacklist(body);
  }

  @Get('/assessment-visit-results')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  async getAssessmentVisitResults(
    @Query() queryParams: GetAssessmentVisitResultsDto,
  ) {
    return this.service.getAssessmentVisitResults(queryParams);
  }

  @Post('/queues/pause')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async countQueues() {
    return {
      assessment_visit_results: await this.assessmentVisitResultQueue.count(),
      assessment_survey_results: await this.assessmentSurveyResultQueue.count(),
    };
  }

  @Get('/queues/failed-count')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async countFailedQueues() {
    return {
      assessment_visit_results: await this.assessmentVisitResultQueue.getFailedCount(),
      assessment_survey_results: await this.assessmentSurveyResultQueue.getFailedCount(),
    };
  }

  @Post('/students')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async createStudents(
    @Body(new MaxItemsPipe(500), new ParseArrayPipe({ items: CreateStudent })) body: CreateStudent[],
  ) {
    await this.service.createStudents(body);
    return {
      msg: 'Success!',
      data: null,
    };
  }

  @Patch('/students')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async updateStudents(
    @Body(new MaxItemsPipe(500), new ParseArrayPipe({ items: UpdateStudent })) body: UpdateStudent[],
  ) {
    await this.service.updateStudents(body);
    return {
      msg: 'Success!',
      data: null,
    };
  }

  @Delete('/students')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async deleteStudents(
    @Body(new MaxItemsPipe(500), new ParseArrayPipe({ items: DeleteStudent })) body: DeleteStudent[],
  ) {
    return this.service.deleteStudents(body);
  }

  @Post('assessment-cycle')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async createAssessmentCycle(@Body() cycleData: CreateAssessmentCycle) {
    return this.service.createAssessmentCycle(cycleData);
  }

  @Post('assessment-cycle/:cycle_id/district-school-mapping')
  @Roles(Role.Admin)
  @UseGuards(JwtAdminGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async createAssessmentCycleDistrictSchoolMapping(
    @Param() params: CycleIdValidateDto,
    @Body(new MaxItemsPipe(500), new ParseArrayPipe({ items: CreateAssessmentCycleDistrictSchoolMapping })) body: CreateAssessmentCycleDistrictSchoolMapping[],
  ) {
    return this.service.createAssessmentCycleDistrictSchoolMapping(params.cycle_id, body);
  }
}
