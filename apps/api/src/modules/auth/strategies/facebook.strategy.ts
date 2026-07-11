import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';

export type FacebookOAuthProfile = {
  facebookId: string;
  fullName: string;
  avatar?: string;
};

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService) {
    // Giá trị fallback chỉ để tránh crash lúc khởi động khi chưa cấu hình OAuth thật.
    super({
      clientID: config.get<string>('FACEBOOK_CLIENT_ID', 'not-configured'),
      clientSecret: config.get<string>(
        'FACEBOOK_CLIENT_SECRET',
        'not-configured',
      ),
      callbackURL: config.get<string>(
        'FACEBOOK_CALLBACK_URL',
        'http://localhost:2222/api/v1/auth/facebook/callback',
      ),
      // passport-facebook 3.0 mặc định dùng Graph API v3.2 (đã quá cũ).
      graphAPIVersion: config.get<string>(
        'FACEBOOK_GRAPH_API_VERSION',
        'v25.0',
      ),
      profileFields: ['id', 'name', 'photos'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: unknown, user?: FacebookOAuthProfile) => void,
  ) {
    const fullName =
      [profile.name?.givenName, profile.name?.familyName]
        .filter(Boolean)
        .join(' ') || profile.displayName;
    const result: FacebookOAuthProfile = {
      facebookId: profile.id,
      fullName,
      avatar: profile.photos?.[0]?.value,
    };
    done(null, result);
  }
}
