import { IsInt, Validate } from 'class-validator';
import { IsExist } from '../../auth/auth.validator';
import { Transform } from 'class-transformer';

export class CreateAssessmentCycleDistrictSchoolMapping {
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  @Validate(IsExist, ['districts', 'id'], {
    message: '',
  })
  district_id!: number;

  @IsInt()
  @Transform(({ value }) => parseInt(value))
  @Validate(IsExist, ['school_list', 'udise'], {
    message: '',
  })
  udise!: number;
}
