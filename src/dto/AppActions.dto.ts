import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GetAppActionsDto {
  @IsString()
  @IsNotEmpty()
  timestamp!: string;
}
