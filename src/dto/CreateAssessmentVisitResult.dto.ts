import { IsArray, IsDateString, IsInt, ValidateNested } from 'class-validator';
import { CreateAssessmentVisitResultStudent } from './CreateAssessmentVisitResultStudent.dto';
import { Type } from 'class-transformer';

export class CreateAssessmentVisitResult {
  @IsDateString()
  submission_date!: Date;

  @IsInt()
  grade!: number;

  @IsInt()
  subject_id!: number;

  @IsInt()
  mentor_id?: number;

  @IsInt()
  no_of_student: number;

  @IsInt()
  actor_id!: number;

  @IsInt()
  block_id?: number;

  @IsInt()
  assessment_type_id?: number;

  @IsInt()
  udise: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentVisitResultStudent)
  students!: CreateAssessmentVisitResultStudent[];
}
