import { HttpStatus } from '@nestjs/common';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';

export function getPrismaErrorStatusAndMessage(error: any): {
  errorMessage: string | undefined;
  statusCode: number;
} {
  if (
    error instanceof PrismaClientKnownRequestError ||
    error instanceof PrismaClientValidationError
  ) {
    // @ts-ignore
    const errorCode = error?.code || 'DEFAULT_ERROR_CODE';

    const errorCodeMap: Record<string, number> = {
      P2000: HttpStatus.BAD_REQUEST,
      P2002: HttpStatus.CONFLICT,
      P2003: HttpStatus.CONFLICT,
      P2025: HttpStatus.NOT_FOUND,
      DEFAULT_ERROR_CODE: HttpStatus.INTERNAL_SERVER_ERROR,
    };

    const statusCode = errorCodeMap[errorCode];
    const errorMessage = error.message.split('\n').pop() || `Some values are missing`;

    return { statusCode, errorMessage };
  }

  const statusCode =
    error?.status ||
    error?.response?.status ||
    HttpStatus.INTERNAL_SERVER_ERROR;

  return {
    statusCode,
    errorMessage: error.message,
  };
}
