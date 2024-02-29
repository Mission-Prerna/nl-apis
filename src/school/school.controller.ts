import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Request,
  Res,
  SetMetadata,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { AppService } from '../app.service';
import { CacheConstants, CacheKeySchoolStudents, JobEnum, Mentor, QueueEnum, Role } from '../enums';
import { JwtAuthGuard } from '../auth/auth-jwt.guard';
import { GetSchoolStudentsDto } from '../dto/GetSchoolStudents.dto';
import { Response } from 'express';
import { EtagService } from '../modules/etag/etag.service';
import { MentorInterceptor } from '../interceptors/mentor.interceptor';
import { SchoolServiceV2 } from './school.service.v2';
import { GetSchoolStatusDto } from '../dto/GetSchoolStatus.dto';
import { GetSchoolStudentsResultDto } from '../dto/GetSchoolStudentsResult.dto';
import { AssessmentCycleValidatorDto } from '../dto/AssessmentCycleValidator.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ExcelFileUploadInterceptor } from 'src/interceptors/excel-file-upload.interceptor';
import { CreateSchoolListResponseDto } from './dto/CreateSchoolListResponse.dto';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('/api/school')
@UseInterceptors(SentryInterceptor)
export class SchoolController {
  constructor(
    private readonly service: SchoolServiceV2,
    private readonly appService: AppService,
    private readonly etagService: EtagService,
    @InjectQueue(QueueEnum.CalculateExaminerCycleUdiseResult)
    private readonly calculateExaminerCycleUdiseResultQueue: Queue,
  ) {}

  @Post('upload')
  @UseInterceptors(ExcelFileUploadInterceptor)
  async uploadCsv(
    @Req() request: any,
  ): Promise<CreateSchoolListResponseDto> {
      const file = request['processedFile'];
      const { failureSchoolList=[], successSchoolList=[] } =
        await this.service.createSchoolListFromFile(file);
      return ({
        message: `${
          successSchoolList.length
        } schools uploaded successfully out of ${
          successSchoolList.length + failureSchoolList.length
        }`,
        successSchoolList,
        failureSchoolList,
      });
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

  @Post(':udise/result/calculate')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(MentorInterceptor)
  async calculateExaminerCycleUdiseResult(
    @Param('udise', ParseIntPipe) udise: number,
    @Query() params: AssessmentCycleValidatorDto,
    @Request() { mentor }: { mentor: Mentor },
  ) {
    await this.calculateExaminerCycleUdiseResultQueue.add(
      JobEnum.ProcessExaminerCycleUdiseResult,
      {
        mentor: mentor,
        udise: udise,
        cycle_id: params.cycle_id,
      },
      {
        attempts: 3,
        removeOnComplete: true,
        backoff: 60000,
        delay: 60000, // we must process the event 1 minute later
      },
    );
    return {
      msg: 'Queued!',
      data: null,
    };
  }
}
