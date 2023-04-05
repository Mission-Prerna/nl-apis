import {
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateAssessmentVisitResultStudentOdkResult } from './CreateAssessmentVisitResultsStudentOdkResult.dto';
import { Type } from 'class-transformer';

export class CreateAssessmentVisitResultStudent {
  @IsString()
  student_name!: string;

  @IsInt()
  competency_id!: number;

  @IsString()
  module: string;

  @IsInt()
  end_time!: bigint;

  @IsBoolean()
  is_passed!: boolean;

  @IsInt()
  start_time: bigint;

  @IsString()
  statement?: string;

  @IsInt()
  achievement: number;

  @IsInt()
  app_version_code: number;

  @IsInt()
  total_questions: number;

  @IsInt()
  success_criteria: number;

  @IsBoolean()
  session_completed: boolean;

  @IsBoolean()
  is_network_active: boolean;

  @IsString()
  workflow_ref_id: string;

  @IsInt()
  total_time_taken?: number;

  @IsUUID()
  student_session: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentVisitResultStudentOdkResult)
  odk_results!: CreateAssessmentVisitResultStudentOdkResult[];
}
