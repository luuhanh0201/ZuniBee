import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

export type GoogleOAuthProfile = {
  googleId: string;
  email: string;
  fullName: string;
  avatar?: string;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    // Giá trị fallback chỉ để tránh crash lúc khởi động khi chưa cấu hình OAuth thật.
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID', 'not-configured'),
      clientSecret: config.get<string>(
        'GOOGLE_CLIENT_SECRET',
        'not-configured',
      ),
      callbackURL: config.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:2222/api/v1/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    const result: GoogleOAuthProfile = {
      googleId: profile.id,
      email: email ?? '',
      fullName: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    };
    done(null, result);
  }
}
