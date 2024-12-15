import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional, IsPhoneNumber, IsString, MaxLength, Validate,
} from 'class-validator';
import { ActorEnum } from '../enums';
import { IsExist } from '../auth/auth.validator';

export class CreateMentorDto {
  @IsPhoneNumber('IN')
  phone_no!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  officer_name!: string;

  @IsInt()
  @Validate(IsExist, ['districts', 'id'], {
    message: '',
  })
  district_id!: number;

  @IsInt()
  @Validate(IsExist, ['blocks', 'id'], {
    message: '',
  })
  block_id!: number | null;

  @IsInt()
  @Validate(IsExist, ['designations', 'id'], {
    message: '',
  })
  designation_id!: number;

  @IsInt()
  @IsIn([
    ActorEnum.MENTOR,
    ActorEnum.EXAMINER,
    ActorEnum.TEACHER,
    ActorEnum.DIET_MENTOR,
    ActorEnum.PARENT,
  ])
  actor_id!: number;

  @IsString()
  @IsOptional()
  area_type!: string;

  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean;

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
