import { Type } from 'class-transformer';
import { IsNotEmpty, IsInt, IsString, Validate, IsUrl, IsOptional } from 'class-validator';
import { IsExist } from 'src/auth/auth.validator';

export class CreateMentorGradeAssessmentDetailsDto {
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

  @IsNotEmpty()
  @IsString()
  mentor_name: string;

  @IsNotEmpty()
  @IsInt()
  grade: number;

  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['school_list', 'udise'])
  udise: number;

  @IsUrl()
  @IsOptional()
  image_url?: string;
}