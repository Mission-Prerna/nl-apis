import { IsNotEmpty, IsNumber } from 'class-validator';

export class GetMentorBotsForActionDto {
  //@IsNumber()
  @IsNotEmpty()
  action!: number;
}
