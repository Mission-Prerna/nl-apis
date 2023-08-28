import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GetMentorBotsForActionDto {
  @IsNumber()
  @IsNotEmpty()
  action!: number;
}
