import { IsNotEmpty } from 'class-validator';
import { ActorEnum } from 'src/enums';

export class MentorClearCacheDto {
  @IsNotEmpty()
  readonly phoneNumbers!: string[];

  @IsNotEmpty()
  readonly actorIds: ActorEnum[];
}
