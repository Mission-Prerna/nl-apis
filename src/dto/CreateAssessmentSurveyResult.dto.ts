import {
  IsArray,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateAssessmentSurveyResultQuestion } from './CreateAssessmentSurveyResultQuestion.dto';
import { Type } from 'class-transformer';

export class CreateAssessmentSurveyResult {
  @IsInt()
  submission_timestamp!: number;

  @IsInt()
  @IsOptional()
  mentor_id?: number;

  @IsInt()
  grade!: number;

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
