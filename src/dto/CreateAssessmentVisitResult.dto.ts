import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateAssessmentVisitResultStudent } from './CreateAssessmentVisitResultStudent.dto';
import { Type } from 'class-transformer';

export class CreateAssessmentVisitResult {
  @IsInt()
  submission_timestamp!: number;

  @IsInt()
  @IsIn([1, 2, 3])
  grade!: number;

  @IsInt()
  @IsIn([0, 1, 2, 3])
  subject_id!: number;

  @IsInt()
  @IsOptional()
  mentor_id?: number;

  @IsInt()
  no_of_student!: number;

  @IsInt()
  @IsIn([1, 2, 3, 4, 5])
  actor_id!: number;

  @IsInt()
  @IsOptional()
  block_id?: number;

  @IsInt()
  @IsOptional()
  @IsIn([1, 2, 3, 4, 5])
  assessment_type_id?: number;

  @IsInt()
  udise!: number;

  @IsInt()
  app_version_code!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentVisitResultStudent)
  results!: CreateAssessmentVisitResultStudent[];
}
