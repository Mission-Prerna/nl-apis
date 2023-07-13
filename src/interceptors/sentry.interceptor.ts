import {
  ExecutionContext,
  Injectable,
  NestInterceptor,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as Sentry from '@sentry/minimal';
import { AppService } from '../app.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  constructor(
    private readonly appService: AppService,
    private readonly jwtService: JwtService,
  ) {
  }

  intercept( context: ExecutionContext, next: CallHandler): Observable<any> {
    return next
      .handle()
      .pipe(
        tap(null, async (exception) => {
          let user: User|undefined = undefined;
          try {
            const headers = context.switchToHttp().getRequest().headers;
            if (headers.authorization) {
              const decodedAuthTokenData = <Record<string, any>>(
                this.jwtService.decode(headers.authorization.split(' ')[1])
              );

              const mentor = await this.appService.findMentorByPhoneNumber(
                decodedAuthTokenData?.['https://hasura.io/jwt/claims']?.[
                  'X-Hasura-User-Id'
                  ],
              );

              if (mentor) {
                user = {
                  id: mentor.id + '',
                  username: mentor.phone_no,
                  actor_id: mentor.actor_id,
                  district_id: mentor.district_id,
                  block_id: mentor.block_id,
                  designation_id: mentor.designation_id,
                }
              }
            }
          } catch (e) {
            // do nothing & let the Sentry capture the main exception
          }

          // capture exception; add user details if any
          Sentry.captureException(exception, {
            user: user
          });
        }),
      );
  }

}