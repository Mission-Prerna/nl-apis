import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard, IAuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements IAuthGuard {
  constructor(private reflector: Reflector) {
    super();
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }
    let isAllowed = false;
    const request: Record<string, any> = context.switchToHttp().getRequest();
    try {
      const tokenRoles: string[] = request['user']['roles'];
      for (const role of roles) {
        if (tokenRoles?.indexOf(role) > -1) {
          isAllowed = true;
          break;
        }
      }
    } catch (error) {
      isAllowed = false;
    }
    return isAllowed;
  }

  handleRequest(err: any, user: any, info: any) {
    return user;
  }
}
