import { IsBoolean, IsInt, IsOptional, Validate } from 'class-validator';
import { IsExist } from '../../auth/auth.validator';
import { Transform } from 'class-transformer';

export class CreateUpdateCwsnStudents {
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  @Validate(IsExist, ['students', 'unique_id'])
  student_id: string;

  @IsInt()
  @Transform(({ value }) => parseInt(value))
  @Validate(IsExist, ['school_list', 'udise'])
  udise: number;

  @IsBoolean()
  @IsOptional()
  is_active: boolean = true
}
