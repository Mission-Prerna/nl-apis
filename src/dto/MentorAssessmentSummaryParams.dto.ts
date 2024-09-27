import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, Validate } from 'class-validator';
import { ValidateGrades } from 'src/auth/auth.validator';

export class MentorAssessmentSummaryParamsDto {
  @IsOptional()
  @Validate(ValidateGrades, ['1', '2', '3'])
  grade?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @IsOptional()
  year?: number;
}
