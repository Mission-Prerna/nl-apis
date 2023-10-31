import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class MaxItemsPipe implements PipeTransform {
  constructor(private readonly maxItems: number) {}

  transform(value: any) {
    if (!Array.isArray(value) || value.length > this.maxItems) {
      throw new BadRequestException(
        `Maximum items allowed is ${this.maxItems}`,
      );
    }
    return value;
  }
}
