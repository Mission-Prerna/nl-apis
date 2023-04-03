import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './auth-jwt.guard';
import { APP_GUARD } from '@nestjs/core';
import { JwtStrategy } from './auth-jwt.strategy';

@Module({
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    JwtStrategy,
  ],
})
export class AuthModule {}
