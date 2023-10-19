import { Type } from 'class-transformer';
import { IsInt, IsOptional, Validate } from 'class-validator';
import { IsExist } from '../auth/auth.validator';

export class GetSchoolStatusDto {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Validate(IsExist, ['assessment_cycles', 'id'])
  cycle_id!: number;
}
