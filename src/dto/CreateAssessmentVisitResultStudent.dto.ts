import {
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateAssessmentVisitResultStudentOdkResult } from './CreateAssessmentVisitResultsStudentOdkResult.dto';
import { Type } from 'class-transformer';

export class CreateAssessmentVisitResultStudent {
  @IsString()
  student_name!: string;

  @IsInt()
  @MaxLength(9)
  competency_id!: number;

  @IsString()
  module: string;

  @IsInt()
  @MaxLength(16)
  end_time!: bigint;

  @IsBoolean()
  is_passed!: boolean;

  @IsInt()
  @MaxLength(16)
  start_time: bigint;

  @IsString()
  statement?: string;

  @IsInt()
  @MaxLength(9)
  achievement: number;

  @IsInt()
  @MaxLength(9)
  app_version_code: number;

  @IsInt()
  @MaxLength(9)
  total_questions: number;

  @IsInt()
  @MaxLength(9)
  success_criteria: number;

  @IsBoolean()
  session_completed: boolean;

  @IsBoolean()
  is_network_active: boolean;

  @IsString()
  workflow_ref_id: string;

  @IsInt()
  @MaxLength(9)
  total_time_taken?: number;

  @IsUUID()
  student_session: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentVisitResultStudentOdkResult)
  odk_results!: CreateAssessmentVisitResultStudentOdkResult[];
}
