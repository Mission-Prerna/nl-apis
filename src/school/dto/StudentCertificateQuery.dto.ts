import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class StudentCertificateQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  limit: number = 5;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  offset: number = 0;
}
