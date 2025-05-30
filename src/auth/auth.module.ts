import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './auth-jwt.guard';
import { JwtStrategy } from './auth-jwt.strategy';
import { JwtAdminGuard } from './admin-jwt.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }), // ✅ Required
    JwtModule.register({}), // optional unless using JwtService
  ],
  controllers: [AuthController],
  providers: [
    JwtAuthGuard,
    JwtAdminGuard,
    JwtStrategy,
    AuthService,
    PrismaService,
  ],
})
export class AuthModule {}
