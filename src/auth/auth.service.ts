import { HttpException, HttpStatus, Injectable, Logger, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { Request, query } from 'express';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AuthService {
    private readonly userServiceBaseURL : string;
    private readonly FAApplicationID: string;
    private readonly FADefaultPassword: string;
    private readonly logger: Logger = new Logger(AuthService.name);
    
    constructor(
        private readonly configService: ConfigService,
        protected readonly prismaService: PrismaService,
        ) {
        this.userServiceBaseURL = configService.getOrThrow('USER_SERVICE_BASE_URL');
        this.FAApplicationID = configService.getOrThrow('FA_APPLICATION_ID');
        this.FADefaultPassword = configService.getOrThrow('FA_DEFAULT_PASSWORD');
    }

    private async callUserService(endpoint: string, req: any, method = 'GET') {
        const url = this.userServiceBaseURL + endpoint;
        try{
            const res = await axios(url, {method, headers: {'x-application-id': this.FAApplicationID, ...req.headers}, params: req.query, data: req.body });
            return res.data;
        }
        catch (error)  
        {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                if (axiosError.response) {
                  const { status, data } = axiosError.response;
                  throw new HttpException(data as string, status);
                } 
            }
            this.logger.error(error);
            throw new HttpException('Unknown error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async sendOTP(request: Request) {
        const { phone } = request.query
        const mentor = await this.prismaService.mentor.findUnique({
            where:{
                phone_no: phone as string
            }
        })

        if(mentor && mentor.is_active == false){
            throw new HttpException("Your account is inactive. Please contact the DC in your District's BSA office for further assistance.", HttpStatus.FORBIDDEN)
        }
        
        const endpoint = `/api/sendOTP`;
        return await this.callUserService(endpoint, request);
    }

    private async generateAuthToken(loginId: string) {
        const endpoint = `/api/login`;

        const request = {
            headers: {
                "Content-Type": "application/json"
            },
            body : {
                "password": this.FADefaultPassword,
                "loginId": loginId,
                "applicationId": this.FAApplicationID
            }
        }
        return await this.callUserService(endpoint, request, "POST");
    }

    async verifyOTPandGenerateAuthToken(request: Request) {
        const endpoint = `/api/verifyOTP`
        const verifyRes = await this.callUserService(endpoint, request);
        if(verifyRes.status.status !== "success") {
            return verifyRes;
        }
        return await this.generateAuthToken(request.query.phone as string)
    }
}
