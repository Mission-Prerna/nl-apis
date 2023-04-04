import {
  IsArray,
  IsDateString,
  IsInt,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateAssessmentVisitResultStudent } from './CreateAssessmentVisitResultStudent.dto';
import { Type } from 'class-transformer';

export class CreateAssessmentVisitResult {
  @IsDateString()
  submission_date!: Date;

  @IsInt()
  @MaxLength(9)
  grade!: number;

  @IsInt()
  @MaxLength(16)
  subject_id!: number;

  @IsInt()
  @MaxLength(16)
  mentor_id?: number;

  @IsInt()
  @MaxLength(9)
  no_of_student: number;

  @IsInt()
  @MaxLength(16)
  actor_id!: number;

  @IsInt()
  @MaxLength(16)
  block_id?: number;

  @IsInt()
  @MaxLength(16)
  assessment_type_id?: number;

  @IsInt()
  @MaxLength(10)
  udise: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentVisitResultStudent)
  students!: CreateAssessmentVisitResultStudent[];
}
