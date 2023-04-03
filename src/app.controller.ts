import { Controller, Get, SetMetadata, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/auth-jwt.guard';
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Roles('Admin', 'OpenRole')
  @UseGuards(JwtAuthGuard)
  getHello(): string {
    return this.appService.getHello();
  }
}
