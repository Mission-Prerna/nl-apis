import FusionAuthClient, {
  RegistrationRequest,
  RegistrationResponse,
} from '@fusionauth/typescript-client';

import ClientResponse from '@fusionauth/typescript-client/build/src/ClientResponse';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/minimal';

@Injectable()
export class FusionauthService {
  fusionauthClient: FusionAuthClient;
  protected readonly logger = new Logger(FusionauthService.name); // logger instance

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.fusionauthClient = new FusionAuthClient(
      configService.getOrThrow<string>('FA_API_KEY'),
      configService.getOrThrow<string>('FA_URL'),
    );
  }

  async createAndRegisterUser(
    user: RegistrationRequest,
  ): Promise<ClientResponse<RegistrationResponse>> {
    return this.fusionauthClient
      .register('', user)
      .then((response: ClientResponse<RegistrationResponse>) => {
          return response;
        },
      )
      .catch((e) => {
        Sentry.captureException(e, {
          user: {
            username: user.user?.username,
          }
        });
        return e;
      });
  }
}
