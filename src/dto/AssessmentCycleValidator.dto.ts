import { Type } from 'class-transformer';
import { IsExist } from '../auth/auth.validator';
import { IsInt, Validate } from 'class-validator';

export class AssessmentCycleValidatorDto {
  @Type(() => Number)
  @IsInt()
  @Validate(IsExist, ['assessment_cycles', 'id'])
  cycle_id!: number;
}
