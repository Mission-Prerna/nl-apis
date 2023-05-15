import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetMentorDetailsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2030)
  @IsOptional()
  year!: number;
}
