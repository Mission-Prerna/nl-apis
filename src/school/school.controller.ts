import {
  Controller,
  Get,
  Headers, ParseArrayPipe,
  Query,
  SetMetadata,
  UseGuards, UseInterceptors,
  Param,
  ParseIntPipe
} from '@nestjs/common';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { AppService } from '../app.service';
import { Mentor, Role } from '../enums';
import { JwtAuthGuard } from '../auth/auth-jwt.guard';
import { GetSchoolStudentsDto } from '../dto/GetSchoolStudents.dto';
import { SchoolService } from './school.service';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('/api/school')
@UseInterceptors(SentryInterceptor)
export class SchoolController {
  constructor(
    private readonly service: SchoolService,
    private readonly appService: AppService,
  ) {}

  @Get(':udise/students')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolStudents(
    @Headers('authorization') authToken: string,
    @Param() params: GetSchoolStudentsDto
  ) {
    await this.appService.getLoggedInMentor(authToken);
    return this.service.getSchoolStudents(params.udise);
  }

  @Get(':udise/students/result')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolStudentsResults(
    @Headers('authorization') authToken: string,
    @Param('udise', ParseIntPipe) udise: number,
    @Query('grade', new ParseArrayPipe({ items: Number, separator: ',' })) grades: number[],
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    const mentor: Mentor = await this.appService.getLoggedInMentor(authToken);
    return this.service.getSchoolStudentsResults(mentor, udise, grades, year, month);
  }

  @Get(':udise/students/result/summary')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolStudentsResultsSummary(
    @Headers('authorization') authToken: string,
    @Param('udise', ParseIntPipe) udise: number,
    @Query('grade', new ParseArrayPipe({ items: Number, separator: ',' })) grades: number[]
  ) {
    const mentor: Mentor = await this.appService.getLoggedInMentor(authToken);
    return this.service.getSchoolStudentsResultsSummary(mentor, udise, grades);
  }

  @Get(':udise/teacher/performance/insights')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolTeacherPerformance(
    @Headers('authorization') authToken: string,
    @Param('udise', ParseIntPipe) udise: number,
  ) {
    const mentor: Mentor = await this.appService.getLoggedInMentor(authToken);
    return this.service.getSchoolTeacherPerformance(mentor, udise);
  }
}
