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
  @Roles('Admin', 'OpenRole')
  @UseGuards(JwtAuthGuard)
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/assessment-visit-results')
  createAssessmentVisitResults(
    @Body() createAssessmentVisitResultDto: CreateAssessmentVisitResult,
  ) {
    try {
      const result = this.appService.createAssessmentVisitResult(
        createAssessmentVisitResultDto,
      );
    } catch (e) {
      console.log('error');
    }
    return 'Created';
  }
}
