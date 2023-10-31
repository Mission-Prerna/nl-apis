import { Injectable } from '@nestjs/common';
import { IAuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './auth-jwt.guard';

@Injectable()
export class JwtAdminGuard extends JwtAuthGuard implements IAuthGuard {
  protected applicationId: string;

  constructor(
    protected reflector: Reflector,
    protected readonly configService: ConfigService,
  ) {
    super(reflector, configService);

    // override the application ID
    this.applicationId = this.configService.get<string>(
      'FA_ADMIN_APPLICATION_ID',
      '',
    );
  }
}
