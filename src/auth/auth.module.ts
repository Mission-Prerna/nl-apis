import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './auth-jwt.guard';
import { JwtStrategy } from './auth-jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JwtAdminGuard } from './admin-jwt.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [],
  providers: [JwtAuthGuard, JwtAdminGuard, JwtStrategy],
})
export class AuthModule {}
