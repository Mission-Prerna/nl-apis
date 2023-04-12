import {
  IsArray,
  IsIn,
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
  @IsIn([1, 2, 3])
  grade!: number;

  @IsInt()
  @IsOptional()
  @IsIn([0, 1, 2, 3])
  subject_id?: number;

  @IsInt()
  @IsIn([1, 2, 3, 4, 5])
  actor_id!: number;

  @IsInt()
  udise!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentSurveyResultQuestion)
  questions!: CreateAssessmentSurveyResultQuestion[];
}
