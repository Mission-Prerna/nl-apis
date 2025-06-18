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
        this.logger.log(`Calling User Service at ${url} with method ${method}`);
        try{
            // Construct curl command for debugging
            const queryString = new URLSearchParams(req.query).toString();
            const curlCommand = 
                `curl -X ${method.toUpperCase()} "${url}${queryString ? `?${queryString}` : ''}" ` +
                `-H "x-application-id: ${this.FAApplicationID}" ` +
                `${Object.entries(req.headers || {})
                    .map(([key, val]) => `-H "${key}: ${val}"`)
                    .join(' ')} ` +
                `-H "Content-Type: application/json" ` +
                (req.body ? `-d '${JSON.stringify(req.body)}'` : '');

            this.logger.log(`[Curl Equivalent] ${curlCommand}`);

            const res = await axios(url, {method, headers: {'x-application-id': this.FAApplicationID, ...req.headers}, params: req.query, data: req.body });
            this.logger.log(`User Service response: ${JSON.stringify(res.data)}`);
            return res.data;
        }
        catch (error)  
        {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                this.logger.error(`Error calling User Service: ${axiosError.message}`);
                if (axiosError.response) {
                  const { status, data } = axiosError.response;
                    this.logger.error(`User Service responded with status ${status} and data: ${JSON.stringify(data)}`);
                  throw new HttpException(data as string, status);
                } 
            }
            this.logger.error(`Unknown error calling User Service: ${error}`);
            this.logger.error(error);
            throw new HttpException('Unknown error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async sendOTP(request: Request) {
        const { phone } = request.query
        this.logger.log(`Sending OTP to phone: ${phone}`);
        const mentor = await this.prismaService.mentor.findUnique({
            where:{
                phone_no: phone as string
            }
        })

        if(!mentor) {
            this.logger.warn(`Mentor not found with phone: ${phone}`);
            throw new HttpException("Mentor not found", HttpStatus.NOT_FOUND);
        }

        this.logger.debug(`Mentor found: ${JSON.stringify(mentor, null, 2)}`);

        
        this.logger.log(`Mentor found with phone: ${phone} and is_active: ${mentor?.is_active}, and id: ${mentor?.id}, sending OTP`);
        if(mentor && mentor.is_active == false){
            this.logger.warn(`Mentor Inactive or Not found'}`);
            throw new HttpException("Your account is inactive. Please contact the DC in your District's BSA office for further assistance.", HttpStatus.FORBIDDEN)
        }


        this.logger.log(`Calling user service to send OTP`);

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
