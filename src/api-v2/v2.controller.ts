import { Controller, Get, Headers, Param, UseGuards } from '@nestjs/common';
import { V2Service } from './v2.service';
import { Role } from '../enums';
import { JwtAuthGuard } from '../auth/auth-jwt.guard';
import { GetSchoolStudentsDto } from '../dto/GetSchoolStudents.dto';
import { Roles } from '../app.controller';

@Controller('api/v2')
export class V2Controller {
  constructor(
    private service: V2Service
  ) {}

  @Get('/school/:udise/students')
  @Roles(Role.OpenRole, Role.Diet)
  @UseGuards(JwtAuthGuard)
  async getSchoolStudents(
    @Headers('authorization') authToken: string,
    @Param() params: GetSchoolStudentsDto
  ) {
    await this.service.getLoggedInMentor(authToken);
    return this.service.getSchoolStudents(params.udise);
  }
}
