// bad-request-exceptions.ts

import { InternalServerErrorException } from '@nestjs/common';
import { HttpExceptionOptions } from '@nestjs/common/exceptions/http.exception';

export class MentorCreationFailedException extends InternalServerErrorException {
  constructor(objectOrError?: string | object | any, descriptionOrOptions?: string | HttpExceptionOptions) {
    super(objectOrError, descriptionOrOptions);
  }
}