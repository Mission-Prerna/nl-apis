import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateAssessmentSurveyResultQuestion } from './CreateAssessmentSurveyResultQuestion.dto';
import { Type } from 'class-transformer';

export class CreateAssessmentSurveyResult {
  @IsDateString()
  submission_date!: Date;

  @IsInt()
  mentor_id!: number;

  @IsInt()
  grade_id!: number;

  @IsInt()
  @IsOptional()
  subject_id?: number;

  @IsInt()
  actor_id!: number;

  @IsInt()
  udise!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentSurveyResultQuestion)
  questions!: CreateAssessmentSurveyResultQuestion[];
}
