import {
  Controller,
  Get,
  Headers,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Query,
  Request,
  Res,
  SetMetadata,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { AppService } from '../app.service';
import { CacheConstants, CacheKeySchoolStudents, Mentor, Role } from '../enums';
import { JwtAuthGuard } from '../auth/auth-jwt.guard';
import { GetSchoolStudentsDto } from '../dto/GetSchoolStudents.dto';
import { Response } from 'express';
import { EtagService } from '../modules/etag/etag.service';
import { MentorInterceptor } from '../interceptors/mentor.interceptor';
import { SchoolServiceV2 } from './school.service.v2';
import { GetSchoolStatusDto } from '../dto/GetSchoolStatus.dto';
import { GetSchoolStudentsResultDto } from '../dto/GetSchoolStudentsResult.dto';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('/api/school')
@UseInterceptors(SentryInterceptor)
export class SchoolController {
  constructor(
    private readonly service: SchoolServiceV2,
    private readonly appService: AppService,
    private readonly etagService: EtagService,
  ) {
  }

  @Get(':udise/students')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolStudents(
    @Param() params: GetSchoolStudentsDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('if-none-match') etagHeader?: string,
  ) {
    const etag = await this.etagService.getEtag(CacheKeySchoolStudents(params.udise), CacheConstants.TTL_SCHOOL_STUDENTS);

    // set the etag
    response.header('ETag', etag.etag);
    if (etagHeader === etag.etag) {
      response.status(304);
      return; // Resource not modified
    }
    return this.service.getSchoolStudents(params.udise);
  }

  @Get(':udise/students/result')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getSchoolStudentsResults(
    @Param('udise', ParseIntPipe) udise: number,
    @Query() params: GetSchoolStudentsResultDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.service.getSchoolStudentsResultsV2(mentor, udise, params);
  }

  @Get(':udise/students/result/summary')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getSchoolStudentsResultsSummary(
    @Param('udise', ParseIntPipe) udise: number,
    @Query('grade', new ParseArrayPipe({ items: Number, separator: ',' })) grades: number[],
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.service.getSchoolStudentsResultsSummary(mentor, udise, grades);
  }

  @Get(':udise/teacher/performance/insights')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getSchoolTeacherPerformance(
    @Param('udise', ParseIntPipe) udise: number,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.service.getSchoolTeacherPerformance(mentor, udise);
  }

  @Get('status')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async getSchoolStatus(
    @Query() params: GetSchoolStatusDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    return this.service.getSchoolStatus(mentor, params);
  }

  @Get(':udise/result/calculate')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async calculateExaminerCycleResult() {
    return {};
  }
}
