import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class GetAssessmentVisitResultsDto {
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(5000)
  limit!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  id!: number;
}
