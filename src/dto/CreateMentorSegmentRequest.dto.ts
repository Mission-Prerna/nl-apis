import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString
} from 'class-validator';

export class CreateMentorSegmentRequest {
  @IsArray()
  @IsString({ each: true })
  phone_numbers!: string[];

  @IsNumber()
  @IsNotEmpty()
  segment_id!: number;
}
