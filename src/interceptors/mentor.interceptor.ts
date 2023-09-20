import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AppService } from '../app.service';

@Injectable()
export class MentorInterceptor implements NestInterceptor {
  constructor(
    private readonly service: AppService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const mentor = await this.service.findMentorByPhoneNumber(req.user.id);
    if (!mentor) {
      throw new BadRequestException('User is invalid!');
    }

    // set mentor & mentorId in the request object
    context.switchToHttp().getRequest().mentorId = mentor.id;
    context.switchToHttp().getRequest().mentor = mentor;

    return next.handle();
  }
}