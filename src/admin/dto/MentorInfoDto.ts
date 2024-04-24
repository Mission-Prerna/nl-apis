import { IsNotEmpty, IsOptional } from 'class-validator';

export class MentorClearCacheDto {
  @IsNotEmpty()
  @IsOptional()
  readonly phoneNumbers?: string[];
}
