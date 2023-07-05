// bad-request-exceptions.ts

import { NotFoundException } from '@nestjs/common';
import { HttpExceptionOptions } from '@nestjs/common/exceptions/http.exception';

export class DbTableNotFoundException extends NotFoundException {
  constructor(objectOrError?: string | object | any, descriptionOrOptions?: string | HttpExceptionOptions) {
    super(objectOrError, descriptionOrOptions);
  }
}