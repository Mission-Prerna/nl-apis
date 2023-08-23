import { IsNotEmpty, IsString } from 'class-validator';

export class UpsertMentorTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
