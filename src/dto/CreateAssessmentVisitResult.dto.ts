import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateAssessmentVisitResultStudent } from './CreateAssessmentVisitResultStudent.dto';
import { Type } from 'class-transformer';
import { ActorEnum, AssessmentTypeEnum, SubjectEnum } from '../enums';

export class CreateAssessmentVisitResult {
  @IsInt()
  submission_timestamp!: number;

  @IsInt()
  @IsIn([1, 2, 3, 4, 5, 6, 7, 8])
  grade!: number;

  @IsInt()
  @IsIn([
    SubjectEnum.MATH,
    SubjectEnum.ENGLISH,
    SubjectEnum.HINDI,
  ])
  subject_id!: number;

  mentor_id!: number;

  @IsInt()
  no_of_student!: number;

  @IsInt()
  @IsOptional()
  @IsIn([
    ActorEnum.MENTOR,
    ActorEnum.EXAMINER,
    ActorEnum.TEACHER,
    ActorEnum.DIET_MENTOR,
    ActorEnum.PARENT,
  ])
  actor_id?: number;

  @IsInt()
  @IsOptional()
  block_id?: number;

  @IsInt()
  @IsOptional()
  @IsIn([
    AssessmentTypeEnum.NIPUN_ABHYAS,
    AssessmentTypeEnum.SUCHI_ABHYAS,
    AssessmentTypeEnum.NIPUN_SUCHI,
    AssessmentTypeEnum.NIPUN_LAKSHYA,
    AssessmentTypeEnum.STATE_LED_ASSESSMENT,
  ])
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
