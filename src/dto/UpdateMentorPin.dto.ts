import {
  IsString, Matches,
  MaxLength, MinLength,
} from 'class-validator';

export class UpdateMentorPinDto {
  @IsString()
  @MaxLength(4)
  @MinLength(4)
  @Matches('[0-9\-]+')
  pin!: number;
}
