import { IsDateString, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateAssessmentCycle {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsDateString()
  start_date!: Date;

  @IsDateString()
  end_date!: Date;

  @IsInt()
  @IsNotEmpty()
  @Min(-1)
  class_1_students_count!: number;

  @IsInt()
  @IsNotEmpty()
  @Min(-1)
  class_2_students_count!: number;

  @IsInt()
  @IsNotEmpty()
  @Min(-1)
  class_3_students_count!: number;

  @IsInt()
  @IsNotEmpty()
  @Min(50)
  nipun_percentage!: number;
}
