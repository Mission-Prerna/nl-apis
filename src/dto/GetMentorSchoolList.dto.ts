import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class GetMentorSchoolList {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(9999)
  year: number;
}
