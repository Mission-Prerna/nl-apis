import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateBotTelemetryDto {
  @IsString()
  @IsNotEmpty()
  botId!: string;

  @IsNumber()
  @IsNotEmpty()
  action!: number;
}
