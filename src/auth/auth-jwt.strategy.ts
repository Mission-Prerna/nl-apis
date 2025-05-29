import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ConfigService) configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('FA_PUBLIC_KEY'),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    console.log('Decoded JWT:', payload);
// console.log('Headers:', request.headers);
console.log('ENV Application ID:', process.env.FA_APPLICATION_ID);

    return {
      roles: payload.roles,
      apiRoles: payload.apiRoles,
      applicationId: payload.applicationId,
      id: payload['https://hasura.io/jwt/claims']['X-Hasura-User-Id'] ?? null,
    };
  }
}
