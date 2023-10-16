import { IsInt, IsOptional, Validate } from 'class-validator';
import { IsExist } from '../../auth/auth.validator';

export class CreateAssessmentCycleDistrictSchoolMapping {
  @IsInt()
  @Validate(IsExist, ['districts', 'id'], {
    message: '',
  })
  district_id!: number;

  @IsInt()
  @IsOptional()
  @Validate(IsExist, ['school_list', 'udise'], {
    message: '',
  })
  udise!: number;
}
