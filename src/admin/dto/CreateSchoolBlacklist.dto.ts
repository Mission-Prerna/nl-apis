import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreateUpdateSchoolBlacklistDto {
  @IsInt()
  @IsNotEmpty()
  actor_id: number;

  @IsNumber()
  @IsNotEmpty()
  udise: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
