import { IsInt, IsNotEmpty, IsString, Validate } from "class-validator";
import { IsExist } from "src/auth/auth.validator";

export class InvalidateStudentAssessmentDto {
  @IsString()
  @IsNotEmpty()
  @Validate(IsExist, ['students', 'unique_id'])
  student_id: string;
  
  @IsString()
  @IsNotEmpty()
  @Validate(IsExist, ['mentor', 'phone_no'])
  mentor_phone: string;
  
  @IsInt()
  @IsNotEmpty()
  @Validate(IsExist, ['assessment_cycles', 'id'])
  cycle_id: number;
}