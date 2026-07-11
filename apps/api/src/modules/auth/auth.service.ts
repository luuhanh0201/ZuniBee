import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID, randomInt, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserRole, type AuthUser } from '@zunibee/shared';
import { UserService } from '@/modules/user/user.service';
import { User } from '@/modules/user/entities/user.entity';
import { UserSession } from '@/modules/auth/entities/user-session.entity';
import { MailService } from '@/modules/mail/mail.service';
import { RegisterDto } from '@/modules/auth/dto/register.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { ForgotPasswordDto } from '@/modules/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/modules/auth/dto/reset-password.dto';
import { ChangePasswordDto } from '@/modules/auth/dto/change-password.dto';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/authenticated-user.type';
import type { GoogleOAuthProfile } from '@/modules/auth/strategies/google.strategy';
import type { FacebookOAuthProfile } from '@/modules/auth/strategies/facebook.strategy';
import type { JwtSignOptions } from '@nestjs/jwt';
import { addDuration } from '@/common/utils/duration.util';

// Bỏ ký tự dễ nhầm khi gõ lại: 0/O, 1/l/I
const TEMP_PASSWORD_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateTempPassword(length = 10): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return result;
}

/** .env chỉ khai báo dạng "15m"/"30d" — ép kiểu hẹp về StringValue mà jsonwebtoken yêu cầu. */
function asExpiresIn(value: string): JwtSignOptions['expiresIn'] {
  return value as JwtSignOptions['expiresIn'];
}

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

const BCRYPT_ROUNDS = 10;

function toPublicUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    roleSelected: user.roleSelected,
    avatar: user.avatar ?? null,
    phone: user.phone ?? null,
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {}

  async register(dto: RegisterDto, ctx: RequestContext = {}) {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.userService.create({
      email: dto.email,
      fullName: dto.fullName,
      role: dto.role,
      passwordHash,
    });

    return this.issueSession(user, ctx);
  }

  async login(dto: LoginDto, ctx: RequestContext = {}) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await this.userService.updateLastLogin(user.id);
    return this.issueSession(user, ctx);
  }

  async loginWithGoogle(profile: GoogleOAuthProfile, ctx: RequestContext = {}) {
    if (!profile.email) {
      throw new UnauthorizedException('Tài khoản Google không có email');
    }
    let user = await this.userService.findByGoogleId(profile.googleId);
    if (!user) {
      user = await this.userService.findByEmail(profile.email);
    }
    if (!user) {
      user = await this.userService.create({
        email: profile.email,
        fullName: profile.fullName || profile.email,
        role: UserRole.STUDENT,
        roleSelected: false,
        googleId: profile.googleId,
        provider: 'google',
        avatar: profile.avatar,
        isVerify: true,
      });
    }
    await this.userService.updateLastLogin(user.id);
    return this.issueSession(user, ctx);
  }

  async loginWithFacebook(
    profile: FacebookOAuthProfile,
    ctx: RequestContext = {},
  ) {
    let user = await this.userService.findByFacebookId(profile.facebookId);
    if (!user) {
      user = await this.userService.create({
        email: null,
        fullName: profile.fullName || 'Người dùng Facebook',
        role: UserRole.STUDENT,
        roleSelected: false,
        facebookId: profile.facebookId,
        provider: 'facebook',
        avatar: profile.avatar,
        isVerify: true,
      });
    }
    await this.userService.updateLastLogin(user.id);
    return this.issueSession(user, ctx);
  }

  async refresh(refreshToken: string, ctx: RequestContext = {}) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET') },
      );
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    const session = await this.sessionRepository.findOne({
      where: { sessionToken: payload.sid, userId: payload.sub },
    });

    if (
      !session ||
      !session.isActive ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.refreshToken !== hashToken(refreshToken)
    ) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    // Xoay vòng refresh token: phát hành cặp token mới, vô hiệu hoá session cũ.
    session.isActive = false;
    session.revokedAt = new Date();
    session.revokeReason = 'rotated';
    await this.sessionRepository.save(session);

    return this.issueSession(user, ctx);
  }

  async logout(sessionToken: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { sessionToken, userId },
    });
    if (!session || !session.isActive) return;

    session.isActive = false;
    session.revokedAt = new Date();
    session.revokeReason = 'logout';
    await this.sessionRepository.save(session);
  }

  /** Kiểm tra email đã đăng ký chưa, rồi sinh mật khẩu tạm và gửi qua email. */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user?.email) {
      throw new NotFoundException(
        'Email này chưa được đăng ký tài khoản ZuniBee',
      );
    }

    const tempPassword = generateTempPassword();

    // Gửi email trước — chỉ ghi đè mật khẩu khi chắc chắn đã gửi được,
    // tránh khoá tài khoản của người dùng nếu SMTP lỗi/chưa cấu hình.
    try {
      await this.mailService.sendTempPassword(
        user.email,
        user.fullName,
        tempPassword,
      );
    } catch {
      throw new InternalServerErrorException(
        'Không thể gửi email lúc này, vui lòng thử lại sau',
      );
    }

    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
    const expiresAt = addDuration(
      new Date(),
      this.config.get<string>('PASSWORD_RESET_EXPIRES_IN', '30m'),
    );
    await this.userService.setTempPassword(user.id, passwordHash, expiresAt);
  }

  /**
   * Xác thực mật khẩu tạm còn hạn, đặt mật khẩu mới, thu hồi mọi phiên cũ,
   * rồi đăng nhập luôn cho người dùng (trả về session mới) để tránh phải đăng nhập lại lần nữa.
   */
  async resetPassword(dto: ResetPasswordDto, ctx: RequestContext = {}) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user?.passwordHash || !user.passwordResetExpiresAt) {
      throw new UnauthorizedException(
        'Mật khẩu tạm không hợp lệ hoặc đã hết hạn',
      );
    }
    if (user.passwordResetExpiresAt < new Date()) {
      throw new UnauthorizedException(
        'Mật khẩu tạm đã hết hạn, vui lòng yêu cầu lại',
      );
    }

    const matches = await bcrypt.compare(dto.tempPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Mật khẩu tạm không đúng');
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userService.setPassword(user.id, newHash);
    await this.revokeAllSessions(user.id);

    return this.issueSession(user, ctx);
  }

  /** Đổi mật khẩu khi đã đăng nhập. Tài khoản chưa từng có mật khẩu (OAuth) thì không cần mật khẩu hiện tại. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('Vui lòng nhập mật khẩu hiện tại');
      }
      const matches = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!matches) {
        throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
      }
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userService.setPassword(user.id, newHash);
  }

  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');
    return toPublicUser(user);
  }

  async selectRole(
    userId: string,
    role: UserRole.STUDENT | UserRole.TEACHER,
    ctx: RequestContext = {},
  ) {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');
    if (user.roleSelected) {
      throw new ConflictException('Vai trò của tài khoản đã được thiết lập');
    }

    const updatedUser = await this.userService.selectRole(userId, role);
    if (!updatedUser) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    await this.revokeAllSessions(userId, 'role_selected');
    return this.issueSession(updatedUser, ctx);
  }

  private async revokeAllSessions(
    userId: string,
    reason = 'password_reset',
  ): Promise<void> {
    await this.sessionRepository.update(
      { userId, isActive: true },
      {
        isActive: false,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    );
  }

  async getSessionTokenFromRefreshToken(
    refreshToken: string,
  ): Promise<{ sessionToken: string; userId: string } | null> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET') },
      );
      return { sessionToken: payload.sid, userId: payload.sub };
    } catch {
      return null;
    }
  }

  private async issueSession(user: User, ctx: RequestContext) {
    const sessionToken = randomUUID();
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      sid: sessionToken,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: asExpiresIn(
        this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
      ),
    });
    const refreshExpiresIn = this.config.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const sessionExpiresIn = this.config.getOrThrow<string>(
      'AUTH_SESSION_EXPIRES_IN',
    );
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: asExpiresIn(refreshExpiresIn),
    });

    const session = this.sessionRepository.create({
      userId: user.id,
      sessionToken,
      refreshToken: hashToken(refreshToken),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      isActive: true,
      expiresAt: addDuration(new Date(), sessionExpiresIn),
    });
    await this.sessionRepository.save(session);

    const tokens: TokenPair = { accessToken, refreshToken };
    return { tokens, user: toPublicUser(user) };
  }
}
