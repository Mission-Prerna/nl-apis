import { IsInt, IsString } from 'class-validator';

export class CreateAssessmentVisitResultStudentOdkResult {
  @IsString()
  question!: string;

  @IsInt()
  answer!: number;
}
