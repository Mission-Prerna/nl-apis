import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID, Validate,
  ValidateNested,
} from 'class-validator';
import { CreateAssessmentVisitResultStudentOdkResult } from './CreateAssessmentVisitResultsStudentOdkResult.dto';
import { Type } from 'class-transformer';
import { IsExist, RequiredWithoutAll } from '../auth/auth.validator';
import { SubjectEnum } from 'src/enums';

export class CreateAssessmentVisitResultStudent {
  @IsString()
  student_name!: string;

  @IsInt()
  competency_id!: number;

  @IsInt()
  @IsOptional()
  @IsIn([SubjectEnum.MATH, SubjectEnum.ENGLISH, SubjectEnum.HINDI])
  subject_id?: number;

  @IsString()
  module!: string;

  @IsInt()
  end_time!: bigint;

  @IsBoolean()
  is_passed!: boolean;

  @IsInt()
  start_time!: bigint;

  @IsString()
  @IsOptional()
  statement?: string;

  @IsInt()
  achievement!: number;

  @IsInt()
  total_questions!: number;

  @IsInt()
  success_criteria!: number;

  @IsBoolean()
  session_completed!: boolean;

  @IsBoolean()
  is_network_active!: boolean;

  @IsString()
  workflow_ref_id!: string;

  @IsInt()
  @IsOptional()
  total_time_taken?: number;

  @IsUUID()
  @IsOptional()
  @Validate(RequiredWithoutAll, ['student_id'], {
    message: '',
  })
  student_session!: string;

  @IsString()
  @IsOptional()
  @Validate(IsExist, ['students', 'unique_id'], {
    message: '',
  })
  @Validate(RequiredWithoutAll, ['student_session'], {
    message: '',
  })
  student_id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentVisitResultStudentOdkResult)
  odk_results!: CreateAssessmentVisitResultStudentOdkResult[];
}
