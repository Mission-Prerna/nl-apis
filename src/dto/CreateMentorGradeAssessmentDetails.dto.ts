import { Type } from 'class-transformer';
import { IsNotEmpty, IsInt, IsString, Validate, IsUrl, IsOptional } from 'class-validator';
import { FileSystemStoredFile, IsFile } from 'nestjs-form-data';
import { IsExist } from 'src/auth/auth.validator';

export class CreateMentorGradeAssessmentDetailsDto {
  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['assessment_cycles', 'id'])
  cycle_id: number;
  
  @IsNotEmpty()
  @IsString()
  teacher_name: string;
  
  @IsNotEmpty()
  @IsString()
  teacher_phone: string;
  
  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  grade: number;

  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Validate(IsExist, ['school_list', 'udise'])
  udise: number;


  @IsOptional()
  @IsFile()
  file?: FileSystemStoredFile;
}