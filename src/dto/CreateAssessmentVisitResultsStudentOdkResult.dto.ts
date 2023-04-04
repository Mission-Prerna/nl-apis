import { IsInt, IsString, MaxLength } from 'class-validator';

export class CreateAssessmentVisitResultStudentOdkResult {
  @IsString()
  question!: string;

  @IsInt()
  @MaxLength(1)
  answer!: number;
}
