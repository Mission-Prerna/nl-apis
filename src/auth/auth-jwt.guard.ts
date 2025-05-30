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
  const can = await super.canActivate(context); // triggers JwtStrategy.validate
  if (!can) {
    return false;
  }

  const request: Record<string, any> = context.switchToHttp().getRequest();

  const roles = this.reflector.get<string[]>('roles', context.getHandler());
  if (!roles) {
    return true;
  }

  let isAllowed = false;
  try {
    const tokenRoles: string[] = request['user']['apiRoles'] ?? request['user']['roles'] ?? [];
    for (const role of roles) {
      if (tokenRoles.includes(role)) {
        isAllowed = true;
        break;
      }
    }

    if (request['user']['applicationId'] !== this.applicationId) {
      isAllowed = false;
      this.logger.error('Authorization failed for token <> Application ID');
      Sentry.captureMessage('Duplicate submission detected', {
        user: { id: request['user']['id'] },
        extra: { applicationId: request['user']['applicationId'] }
      });
    }
  } catch (error) {
    this.logger.error('JwtAuthGuard error:', error);
    isAllowed = false;
  }

  return isAllowed;
}


//  public async canActivate(context: ExecutionContext): Promise<boolean> {
//   const can = await super.canActivate(context); // this triggers JwtStrategy.validate
//   if (!can) {
//     return false; // short-circuit if auth failed
//   }

  

//   const roles = this.reflector.get<string[]>('roles', context.getHandler());
//   if (!roles) {
//     return true;
//   }

//   const request: Record<string, any> = context.switchToHttp().getRequest();
//   let isAllowed = false;
//   const authHeader = request.headers['authorization'];
// this.logger.warn(`Bearer Token: ${bearerToken}`);


//   try {
//     const tokenRoles: string[] = request['user']['apiRoles'] ?? request['user']['roles'] ?? [];
//     for (const role of roles) {
//       if (tokenRoles?.includes(role)) {
//         isAllowed = true;
//         break;
//       }
//     }

//     // Log headers and details
//     const authHeader = request.headers['authorization'] || request.headers['Authorization'];
//     const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
//     this.logger.warn(`Bearer Token: ${bearerToken}`);
//     this.logger.warn(`Request Headers: ${JSON.stringify(request.headers, null, 2)}`);
//     this.logger.warn(`Request Body: ${JSON.stringify(request.body, null, 2)}`);
//     this.logger.warn(`Request URL: ${request.url}`);
//     this.logger.warn(`Request Method: ${request.method}`);
//     this.logger.warn('FA_APPLICATION_ID ENV VALUE:', this.configService.get('FA_APPLICATION_ID'));
//     this.logger.warn('FA_APPLICATION_ID ENV VALUE--:', this.applicationId);
//     this.logger.warn('Request User:', JSON.stringify(request['user'], null, 2));
//     this.logger.warn('Request User Application ID:', request['user']['applicationId']);

//     // Validate applicationId
//     if (request['user']['applicationId'] !== this.applicationId) {
//       isAllowed = false;
//       this.logger.error('Authorization failed for token <> Application ID');
//       Sentry.captureMessage('Duplicate submission detected', {
//         user: { id: request['user']['id'] },
//         extra: { applicationId: request['user']['applicationId'] }
//       });
//     }
//   } catch (error) {
//     this.logger.error('JwtAuthGuard error:', error);
//     isAllowed = false;
//   }

//   return isAllowed;
// }


  // noinspection JSUnusedLocalSymbols
  handleRequest(err: any, user: any, info: any) {
    return user;
  }
}
