import {
  ArrayUnique,
  IsArray,
} from 'class-validator';

export class SchoolGeofencingBlacklistDto {
  @IsArray()
  @ArrayUnique()
  blacklist!: Array<bigint>;

  @IsArray()
  @ArrayUnique()
  whitelist!: Array<bigint>;
}
