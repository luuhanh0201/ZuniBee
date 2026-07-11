import { UserRole } from '@zunibee/shared';

/** Payload gắn vào `request.user` sau khi JwtStrategy xác thực access token. */
export type AuthenticatedUser = {
  id: string;
  email: string | null;
  role: UserRole;
};

/** Payload ký trong access token JWT. */
export type AccessTokenPayload = {
  sub: string;
  email: string | null;
  role: UserRole;
};

/** Payload ký trong refresh token JWT. */
export type RefreshTokenPayload = {
  sub: string;
  sid: string;
};
