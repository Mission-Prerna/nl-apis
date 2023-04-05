import { IsString } from 'class-validator';

export class CreateAssessmentSurveyResultQuestion {
  @IsString()
  question_id!: string;

  @IsString()
  value!: string;
}
