import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const COOKIE_ISSUING_AUTH_ROUTES = [
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/auth/reset-password',
];

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<string>('NODE_ENV') !== 'production') return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (
      !COOKIE_ISSUING_AUTH_ROUTES.some((route) => request.path.endsWith(route))
    ) {
      return true;
    }

    const expectedOrigin = new URL(this.config.getOrThrow<string>('WEB_URL'))
      .origin;
    if (
      request.headers.origin !== expectedOrigin ||
      request.headers['x-requested-with'] !== 'XMLHttpRequest'
    ) {
      throw new ForbiddenException('Nguồn yêu cầu không được phép');
    }
    return true;
  }
}
