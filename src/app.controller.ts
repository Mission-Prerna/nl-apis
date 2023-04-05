import {
  Body,
  Controller,
  Get,
  Post,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/auth-jwt.guard';
import { CreateAssessmentVisitResult } from './dto/CreateAssessmentVisitResult.dto';
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return 'NL Assessments Visit Result App';
  }

  @Roles('Admin', 'OpenRole')
  @UseGuards(JwtAuthGuard)
  @Post('/assessment-visit-results')
  async createAssessmentVisitResults(
    @Body() createAssessmentVisitResultDto: CreateAssessmentVisitResult,
  ) {
    await this.appService.createAssessmentVisitResult(
      createAssessmentVisitResultDto,
    );
    return 'Created';
  }
}
