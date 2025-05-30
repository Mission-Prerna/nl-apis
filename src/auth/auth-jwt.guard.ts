import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard, IAuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/minimal';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements IAuthGuard {
  protected logger = new Logger(JwtAuthGuard.name);
  protected applicationId: string;
  constructor(
    protected reflector: Reflector,
    protected readonly configService: ConfigService,
  ) {
    super();
    this.applicationId = this.configService.get<string>('FA_APPLICATION_ID', '');
  }
  
 public async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }
    let isAllowed = false;
    const request: Record<string, any> = context.switchToHttp().getRequest();
    try {
      const tokenRoles: string[] = request['user']['apiRoles'] ?? request['user']['roles'] ?? [];
      for (const role of roles) {
        if (tokenRoles?.indexOf(role) > -1) {
          isAllowed = true;
          break;
        }
      }

      // We'll check if the token is from the very same application as needed in the app
      if (request['user']['applicationId'] !== this.applicationId) {
        // as this token doesn't belongs to the regular user Application
        isAllowed = false;
        this.logger.error('Authorization failed for token <> Application ID');
        Sentry.captureMessage('Duplicate submission detected', {
          user: {
            id: request['user']['id'],
          },
          extra: {
            applicationId: request['user']['applicationId'],
          }
        });
      }
    } catch (error) {
      isAllowed = false;
    }
    return isAllowed;
  }


  // noinspection JSUnusedLocalSymbols
  handleRequest(err: any, user: any, info: any) {
    return user;
  }
}
