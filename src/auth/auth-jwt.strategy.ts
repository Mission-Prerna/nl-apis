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
    try {
      this.logger.log(`Decoded JWT payload: ${JSON.stringify(payload, null, 2)}`);
      this.logger.log(`ENV FA_APPLICATION_ID: ${process.env.FA_APPLICATION_ID}`);

      return {
        roles: payload.roles,
        apiRoles: payload.apiRoles,
        applicationId: payload.applicationId,
        id: payload['https://hasura.io/jwt/claims']['X-Hasura-User-Id'] ?? null,
      };
    } catch (err) {
      this.logger.error('JWT validation failed:', err);
      throw err;
    }
  }
}
