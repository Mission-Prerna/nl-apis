import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateAssessmentSurveyResultQuestion } from './CreateAssessmentSurveyResultQuestion.dto';
import { Type } from 'class-transformer';
import { ActorEnum, SubjectEnum } from '../enums';

export class CreateAssessmentSurveyResult {
  @IsInt()
  submission_timestamp!: number;

  mentor_id!: number;

  @IsInt()
  @IsIn([1, 2, 3, 4, 5, 6, 7, 8])
  grade!: number;

  @IsInt()
  @IsOptional()
  @IsIn([
    SubjectEnum.NULL,
    SubjectEnum.MATH,
    SubjectEnum.ENGLISH,
    SubjectEnum.HINDI,
  ])
  subject_id?: number;

  @IsInt()
  @IsIn([
    ActorEnum.MENTOR,
    ActorEnum.EXAMINER,
    ActorEnum.TEACHER,
    ActorEnum.DIET_MENTOR,
    ActorEnum.PARENT,
  ])
  actor_id!: number;

  @IsInt()
  udise!: number;

  @IsInt()
  app_version_code!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentSurveyResultQuestion)
  questions!: CreateAssessmentSurveyResultQuestion[];
}
