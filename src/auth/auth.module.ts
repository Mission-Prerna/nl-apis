import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './auth-jwt.guard';
import { JwtStrategy } from './auth-jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JwtAdminGuard } from './admin-jwt.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule],
  controllers: [AuthController],
  providers: [
    JwtAuthGuard,
    JwtAdminGuard,
    JwtStrategy,
    AuthService,
  ],
})
export class AuthModule {}
