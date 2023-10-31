import { IsNotEmpty } from 'class-validator';

export class MentorClearCacheDto {
  @IsNotEmpty()
  readonly phoneNumbers!: string[];
}
