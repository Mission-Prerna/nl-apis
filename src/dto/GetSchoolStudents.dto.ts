import { Type } from 'class-transformer';

export class GetSchoolStudentsDto {
  @Type(() => BigInt)
  udise!: number;
}
