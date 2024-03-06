import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';
import { IsExist } from '../../auth/auth.validator';
import { Transform } from 'class-transformer';

export class UpdateStudent {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  name!: string;

  @IsString()
  @IsIn(['male', 'female'])
  @IsOptional()
  gender!: string;

  @IsDateString()
  @IsOptional()
  dob!: Date;

  @IsDateString()
  @IsOptional()
  admission_date!: Date;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @IsOptional()
  roll_no!: number;

  @IsString()
  @IsNotEmpty()
  unique_id!: string;

  @IsInt()
  @Min(1)
  @Max(8)
  @IsOptional()
  grade!: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  @IsOptional()
  father_name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  @IsOptional()
  mother_name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1)
  @IsOptional()
  section!: string;

  @IsInt()
  @Validate(IsExist, ['school_list', 'udise'], {
    message: '',
  })

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  udise!: number;

  @IsDateString()
  @IsOptional()
  deleted_at!: Date | null;
}
