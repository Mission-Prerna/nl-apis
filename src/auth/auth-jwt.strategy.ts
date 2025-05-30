import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  protected logger = new Logger(JwtStrategy.name);

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const publicKey = configService.getOrThrow<string>('FA_PUBLIC_KEY').replace(/\\n/g, '\n');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
    this.logger.log('------ JwtStrategy instantiated -------');
  }

  async validate(payload: any) {
  this.logger.log('✅ JwtStrategy.validate() called');
  this.logger.log('Decoded JWT Payload:', JSON.stringify(payload, null, 2));

  if (!payload || !payload['https://hasura.io/jwt/claims']) {
    this.logger.error('❌ Missing required JWT claims');
    return null;
  }

  return {
    roles: payload.roles ?? [],
    apiRoles: payload.apiRoles ?? [],
    applicationId: payload.applicationId ?? payload['https://hasura.io/jwt/claims']['X-Hasura-Application-Id'],
    id: payload['https://hasura.io/jwt/claims']['X-Hasura-User-Id'],
  };
}

}
