import { IsInt, Validate } from 'class-validator';
import { IsExist } from '../../auth/auth.validator';
import { Transform } from 'class-transformer';

export class CreateAssessmentCycleDistrictExaminerMapping {
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  @Validate(IsExist, ['districts', 'id'], {
    message: '',
  })
  district_id!: number;

  @IsInt()
  @Transform(({ value }) => parseInt(value))
  @Validate(IsExist, ['mentor', 'id'], {
    message: '',
  })
  mentor_id!: number;
}
