import {
  IsBoolean,
  IsDecimal,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class SchoolListExcelDataDto {
  @IsInt()
  @IsNotEmpty()
  udise: number;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  area_type: string;

  @IsString()
  @IsNotEmpty()
  block: string;

  @IsString()
  @IsNotEmpty()
  nypanchayat: string;

  @IsBoolean()
  @IsNotEmpty()
  is_sankul: boolean;

  @IsBoolean()
  @IsNotEmpty()
  geo_fence_enabled: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  type?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  udise_code?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsInt()
  total_student_registered?: number;

  @IsOptional()
  @IsDecimal()
  @IsNotEmpty()
  lat?: number;

  @IsOptional()
  @IsDecimal()
  @IsNotEmpty()
  long?: number;
}

export class CreateSchoolListDto extends SchoolListExcelDataDto {
  @IsInt()
  @IsNotEmpty()
  district_id: number;

  @IsInt()
  @IsNotEmpty()
  block_id: number;

  @IsOptional()
  @IsInt()
  @IsNotEmpty()
  nyay_panchayat_id?: number;
}