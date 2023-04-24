import { IsString } from 'class-validator';

export class CreateAssessmentVisitResultStudentOdkResult {
  @IsString()
  question!: string;

  @IsString()
  answer!: string;
}
