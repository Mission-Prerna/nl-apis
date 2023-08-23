export class UpsertMentorTokenDto {
  // removing these validations to allow app send the pin either in integer or string
  // @MaxLength(4)
  // @MinLength(4)
  // @Matches('[0-9\-]+')
  token!: number;
}
