import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class GetMentorBotsWithActionDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  action!: number;
}
