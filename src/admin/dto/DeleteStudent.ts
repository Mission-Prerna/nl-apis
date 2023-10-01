import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteStudent {
  @IsString()
  @IsNotEmpty()
  unique_id!: string;
}
