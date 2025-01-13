import { Type } from 'class-transformer';
import { IsNotEmpty, IsInt, IsString, Validate } from 'class-validator';
import { FileSystemStoredFile, HasMimeType, IsFile } from 'nestjs-form-data';
import { IsExist } from 'src/auth/auth.validator';

export class CreateAssessmentProofDto {
  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['assessment_cycles', 'id'])
  cycle_id: number;

  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['mentor', 'id'])
  mentor_id: number;

  @IsNotEmpty()
  @IsString()
  @Validate(IsExist, ['students', 'unique_id'])
  student_id: string;

  @Type(() => Number) // This decorator converts the string to a number
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['school_list', 'udise'])
  udise: number;

  @IsNotEmpty()
  @IsFile()
  file: FileSystemStoredFile;
}
