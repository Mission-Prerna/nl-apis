import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import { IsExist } from 'src/auth/auth.validator';

export class CreateCompetencyBadgeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  image_url: string;

  @IsString()
  @IsOptional()
  audio_url?: string;

  @IsString()
  @IsOptional()
  haptic_pattern?: string;

  @IsInt()
  @Validate(IsExist, ['competency_mapping', 'competency_id'])
  competency_id: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;
}
