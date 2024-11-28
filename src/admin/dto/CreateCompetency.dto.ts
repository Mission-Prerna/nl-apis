import { IsInt, IsNotEmpty, IsOptional, IsString, Validate, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsExist } from 'src/auth/auth.validator';

export class CreateCompetencyDto {
  @IsString()
  @IsNotEmpty()
  grade: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  learning_outcome: string;

  @IsInt()
  @IsNotEmpty()
  competency_id: number;

  @IsInt()
  @IsOptional()
  min_app_version_code?: number;

  @IsInt()
  @IsNotEmpty()
  @Validate(IsExist, ['subjects', 'id'])
  subject_id: number;

  @IsInt()
  @IsOptional()
  flow_state?: number;

  @IsInt()
  @IsOptional()
  pass_percent?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any>;
}
