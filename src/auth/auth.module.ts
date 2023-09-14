import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './auth-jwt.guard';
import { JwtStrategy } from './auth-jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JwtAdminGuard } from './admin-jwt.guard';

@Module({
  imports: [JwtModule],
  controllers: [],
  providers: [
    JwtAuthGuard,
    JwtAdminGuard,
    JwtStrategy,
  ],
})
export class AuthModule {}
