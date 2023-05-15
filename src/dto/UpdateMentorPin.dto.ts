import {
  IsInt,
  Max, Min,
} from 'class-validator';

export class UpdateMentorPinDto {
  @IsInt()
  @Min(1000)
  @Max(9999)
  pin!: number;
}
