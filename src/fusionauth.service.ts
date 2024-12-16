import FusionAuthClient, {
  RegistrationRequest,
  RegistrationResponse,
  UserResponse,
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

  // Existing method to create and register user
  async createAndRegisterUser(
    user: RegistrationRequest,
  ): Promise<ClientResponse<RegistrationResponse>> {
    return this.fusionauthClient
      .register('', user)
      .then((response: ClientResponse<RegistrationResponse>) => {
        return response;
      })
      .catch((e) => {
        Sentry.captureException(e, {
          user: {
            username: user.user?.username,
          }
        });
        return e;
      });
  }

  // method to reactivate a user on fusion auth
  async reactivateUser(username: string): Promise<ClientResponse<any>> {
    try {
      // Fetch the user by username to get the userId
      const userResponse:any = await this.fusionauthClient.retrieveUserByUsername(username);
      this.logger.log(`FusionAuth user with details ${userResponse} fetched successfully for reactivating`);

      if (userResponse.statusCode === 200 && userResponse.response) {
        const userId = userResponse.response.user.id;

        const updateResponse = await this.fusionauthClient.reactivateUser(userId);

        // If reactivation is successful, return the response
        if (updateResponse.statusCode === 200 && updateResponse.response) {
          this.logger.log(`User with username ${username} reactivated successfully.`);
          return updateResponse;
        } else {
          // Handle failure response
          this.logger.error(`Failed to reactivate user on FusionAuth with username ${username}`, updateResponse);
          throw new Error(`Failed to reactivate user on FusionAuth: ${username}`);
        }
      } else {
        // User not found or other error
        this.logger.error(`User with username ${username} not found in FusionAuth.`);
        throw new Error(`User not found on FusionAuth: ${username}`);
      }
    } catch (e) {
      // Handle error and capture in Sentry
      Sentry.captureException(e, {
        user: {
          username: username,
        }
      });
      this.logger.error(`Error reactivating user on FusionAuth with username ${username}`, e);
      throw new Error(`Error reactivating user on FusionAuth: ${username}`);
    }
  }
}
