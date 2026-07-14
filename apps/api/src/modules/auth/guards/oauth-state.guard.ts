import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const GOOGLE_STATE_COOKIE = 'zunibee-oauth-google';
const FACEBOOK_STATE_COOKIE = 'zunibee-oauth-facebook';

type OAuthRequest = Request & { oauthState?: string };

function cookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    secure: config.get<string>('NODE_ENV') === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: STATE_MAX_AGE_MS,
  };
}

function cookieName(config: ConfigService, name: string): string {
  return config.get<string>('NODE_ENV') === 'production'
    ? `__Host-${name}`
    : name;
}

function validateState(
  context: ExecutionContext,
  config: ConfigService,
  cookieName: string,
): boolean {
  const request = context.switchToHttp().getRequest<Request>();
  const response = context.switchToHttp().getResponse<Response>();
  const queryState =
    typeof request.query.state === 'string' ? request.query.state : '';
  const cookies = request.cookies as Record<string, string> | undefined;
  const cookieState = cookies?.[cookieName] ?? '';
  response.clearCookie(cookieName, cookieOptions(config));

  const queryBuffer = Buffer.from(queryState);
  const cookieBuffer = Buffer.from(cookieState);
  if (
    !queryState ||
    !cookieState ||
    queryBuffer.length !== cookieBuffer.length ||
    !timingSafeEqual(queryBuffer, cookieBuffer)
  ) {
    throw new UnauthorizedException('Phiên OAuth không hợp lệ hoặc đã hết hạn');
  }
  return true;
}

@Injectable()
export class GoogleOAuthStartGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<OAuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    request.oauthState = randomBytes(32).toString('base64url');
    response.cookie(
      cookieName(this.config, GOOGLE_STATE_COOKIE),
      request.oauthState,
      cookieOptions(this.config),
    );
    return super.canActivate(context);
  }

  override getAuthenticateOptions(context: ExecutionContext) {
    return {
      state: context.switchToHttp().getRequest<OAuthRequest>().oauthState,
    };
  }
}

@Injectable()
export class FacebookOAuthStartGuard extends AuthGuard('facebook') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<OAuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    request.oauthState = randomBytes(32).toString('base64url');
    response.cookie(
      cookieName(this.config, FACEBOOK_STATE_COOKIE),
      request.oauthState,
      cookieOptions(this.config),
    );
    return super.canActivate(context);
  }

  override getAuthenticateOptions(context: ExecutionContext) {
    return {
      state: context.switchToHttp().getRequest<OAuthRequest>().oauthState,
    };
  }
}

@Injectable()
export class GoogleOAuthStateGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    return validateState(
      context,
      this.config,
      cookieName(this.config, GOOGLE_STATE_COOKIE),
    );
  }
}

@Injectable()
export class FacebookOAuthStateGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    return validateState(
      context,
      this.config,
      cookieName(this.config, FACEBOOK_STATE_COOKIE),
    );
  }
}
