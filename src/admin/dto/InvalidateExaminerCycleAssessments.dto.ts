import { Transform, Type } from 'class-transformer';
import { IsExist } from '../../auth/auth.validator';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  Validate,
} from 'class-validator';

export class InvalidateExaminerCycleAssessmentsDto {
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  @Validate(IsExist, ['mentor', 'id'], {
    message: '',
  })
  mentor_id!: number;

  @Type(() => Array<number>)
  @IsArray()
  @ArrayNotEmpty()
  udises!: Array<number>;

  @Type(() => Boolean)
  @IsBoolean()
  delete_all!: boolean;
}
