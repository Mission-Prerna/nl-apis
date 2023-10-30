import { IsInt, Validate } from 'class-validator';
import { IsExist } from '../../auth/auth.validator';
import { Transform } from 'class-transformer';

export class CycleIdValidateDto {
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  @Validate(IsExist, ['assessment_cycles', 'id'], {
    message: '',
  })
  cycle_id!: number;
}
