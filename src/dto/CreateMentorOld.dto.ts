import {
  IsIn,
  IsInt,
  IsOptional, IsPhoneNumber, IsString, MaxLength, Validate,
} from 'class-validator';
import { IsExist } from '../auth/auth.validator';

export class CreateMentorOldDto {
  @IsPhoneNumber('IN')
  phone_no!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  officer_name!: string;

  @IsString()
  @Validate(IsExist, ['districts', 'name'], {
    message: '',
  })
  district_name!: string;

  @IsString()
  @Validate(IsExist, ['blocks', 'name'], {
    message: '',
  })
  block_town_name!: string;

  @IsString()
  @IsIn(['examiner', 'TSPL', 'S.R. G', 'Prinicipal Secretary', 'Diet Mentor', 'teacher', 'ARP', 'TEST', 'SRG', 'ARP NAGAR'])
  designation!: string;

  @IsString()
  @IsOptional()
  area_type!: string;

  @IsString()
  @IsOptional()
  subject_of_matter!: string;

  @IsInt()
  @IsOptional()
  @Validate(IsExist, ['school_list', 'udise'], {
    message: '',
  })
  udise!: number;
}
