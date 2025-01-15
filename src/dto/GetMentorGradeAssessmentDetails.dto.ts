import { Type } from 'class-transformer';
import { IsNotEmpty, IsInt, IsString, Validate, IsUrl } from 'class-validator';
import { IsExist } from 'src/auth/auth.validator';

export class GetMentorGradeAssessmentDetailsDto {
  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['assessment_cycles', 'id'])
  cycle_id: number;

  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['mentor', 'id'])
  mentor_id: number;
  
  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  grade: number;

  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['school_list', 'udise'])
  udise: number;

}