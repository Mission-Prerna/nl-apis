import { Type } from 'class-transformer';
import {
  IsExist,
  RequiredWithAll,
  RequiredWithoutAll,
  ValidateGrades,
} from '../auth/auth.validator';
import { IsInt, IsOptional, Max, Min, Validate } from 'class-validator';

export class GetSchoolStudentsResultDto {
  @Validate(ValidateGrades, ['1', '2', '3'])
  grade!: string;

  @Type(() => Number)
  @IsInt()
  @Validate(IsExist, ['assessment_cycles', 'id'])
  @Validate(RequiredWithoutAll, ['year', 'month'])
  @IsOptional()
  cycle_id!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @Validate(RequiredWithAll, ['year'])
  @Validate(RequiredWithoutAll, ['cycle_id'])
  @IsOptional()
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2030)
  @Validate(RequiredWithAll, ['month'])
  @Validate(RequiredWithoutAll, ['cycle_id'])
  @IsOptional()
  year!: number;
}
