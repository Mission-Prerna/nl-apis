import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export class JwtStrategy extends PassportStrategy(Strategy) {
    protected logger = new Logger(JwtStrategy.name);

  constructor(@Inject(ConfigService) configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('FA_PUBLIC_KEY'),
      algorithms: ['RS256'],
    });
    this.logger.log('------JwtStrategy instantiated-------'); // ← Add this
  }

  async validate(payload: any) {
    this.logger.log('Decoded JWT:', payload);
// this.logger.log('Headers:', request.headers);
this.logger.log('ENV Application ID:', process.env.FA_APPLICATION_ID);

    return {
      roles: payload.roles,
      apiRoles: payload.apiRoles,
      applicationId: payload.applicationId,
      id: payload['https://hasura.io/jwt/claims']['X-Hasura-User-Id'] ?? null,
    };
  }
}
