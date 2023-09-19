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

export class CreateStudent {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsIn(['male', 'female'])
  gender!: string;

  @IsDateString()
  @IsOptional()
  dob!: string;

  @IsDateString()
  @IsOptional()
  admission_date!: string;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  roll_no!: number;

  @IsString()
  @IsNotEmpty()
  unique_id!: string;

  @IsInt()
  @Min(1)
  @Max(8)
  grade!: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  father_name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  mother_name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1)
  section!: string;

  @IsInt()
  @Validate(IsExist, ['school_list', 'udise'], {
    message: '',
  })
  udise!: number;
}
