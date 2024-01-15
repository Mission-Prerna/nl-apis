import { Controller, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request } from 'express';


@Controller('auth')
export class AuthController {
    constructor(private readonly authService : AuthService) {}

    @Post('sendOTP')
    async sendOTP(@Req() request: Request) {
        return this.authService.sendOTP(request);
    }

    @Post('verifyOTP')
    async verifyOTP(@Req() request: Request) {
        return this.authService.verifyOTP(request);
    }
}
