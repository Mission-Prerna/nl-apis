import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsInt, IsOptional, IsArray, Validate } from 'class-validator';
import { IsExist } from 'src/auth/auth.validator';

export class GetMentorGradeAssessmentDetailsDto {
  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['assessment_cycles', 'id'])
  cycle_id: number;
  
  @IsOptional()
  @Transform(({ value }) => 
    value ? value.split(',').map((v: string) => parseInt(v.trim(), 10)) : []
  )
  @IsArray()
  @IsInt({ each: true })
  grade?: number[];

  @IsOptional()
  @Transform(({ value }) => 
    value ? value.split(',').map((v: string) => parseInt(v.trim(), 10)) : []
  )
  @IsArray()
  @Validate(IsExist, ['school_list', 'udise'], { each: true })
  udise?: number[];
}
