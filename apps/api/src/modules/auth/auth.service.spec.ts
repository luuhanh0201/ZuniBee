import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@zunibee/shared';
import { AuthService } from './auth.service';
import type { UserSession } from './entities/user-session.entity';
import type { User } from '@/modules/user/entities/user.entity';
import type { UserService } from '@/modules/user/user.service';
import type { MailService } from '@/modules/mail/mail.service';

function user(overrides: Partial<User> = {}): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'user@example.com',
    passwordHash: bcrypt.hashSync('matkhau123', 4),
    fullName: 'Người Dùng',
    phone: null,
    avatar: null,
    role: UserRole.STUDENT,
    roleSelected: true,
    status: UserStatus.ACTIVE,
    lastLoginAt: null,
    isVerify: true,
    provider: null,
    googleId: 'google-1',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function setup(found: User | null) {
  const createUser = jest.fn();
  const updateLastLogin = jest.fn();
  const userService = {
    findByEmail: jest.fn().mockResolvedValue(found),
    findById: jest.fn().mockResolvedValue(found),
    findByGoogleId: jest.fn().mockResolvedValue(found),
    findByFacebookId: jest.fn().mockResolvedValue(found),
    create: createUser,
    updateLastLogin,
  } as unknown as UserService;
  const service = new AuthService(
    userService,
    {
      signAsync: jest.fn().mockResolvedValue('token'),
    } as unknown as JwtService,
    {
      get: jest.fn(),
      getOrThrow: jest.fn().mockReturnValue('15m'),
    } as unknown as ConfigService,
    {} as MailService,
    {
      create: jest.fn((value: Partial<UserSession>) => value),
      save: jest.fn((value: Partial<UserSession>) => Promise.resolve(value)),
      findOne: jest.fn(),
    } as unknown as Repository<UserSession>,
  );
  return { service, createUser, updateLastLogin };
}

const REFRESH_TOKEN = 'refresh-token-1';

function session(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'session-1',
    userId: '00000000-0000-4000-8000-000000000001',
    sessionToken: 'sid-1',
    refreshToken: createHash('sha256').update(REFRESH_TOKEN).digest('hex'),
    isActive: true,
    revokedAt: undefined,
    revokeReason: undefined,
    expiresAt: new Date(Date.now() + 86_400_000),
    ...overrides,
  } as UserSession;
}

function setupRefresh(sessionRow: UserSession | null, found: User | null) {
  const sessionSave = jest.fn((value: Partial<UserSession>) =>
    Promise.resolve(value),
  );
  const service = new AuthService(
    {
      findById: jest.fn().mockResolvedValue(found),
    } as unknown as UserService,
    {
      signAsync: jest.fn().mockResolvedValue('new-token'),
      verifyAsync: jest.fn().mockResolvedValue({
        sub: '00000000-0000-4000-8000-000000000001',
        sid: 'sid-1',
      }),
    } as unknown as JwtService,
    {
      get: jest.fn(),
      getOrThrow: jest.fn().mockReturnValue('15m'),
    } as unknown as ConfigService,
    {} as MailService,
    {
      findOne: jest.fn().mockResolvedValue(sessionRow),
      save: sessionSave,
      create: jest.fn((value: Partial<UserSession>) => value),
    } as unknown as Repository<UserSession>,
  );
  return { service, sessionSave };
}

describe('AuthService refresh với rotation grace', () => {
  it('session active refresh bình thường và bị xoay vòng', async () => {
    const row = session();
    const { service } = setupRefresh(row, user());
    const result = await service.refresh(REFRESH_TOKEN);
    expect(result.user.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(row.isActive).toBe(false);
    expect(row.revokeReason).toBe('rotated');
  });

  it('token vừa bị xoay vòng trong grace window vẫn refresh được', async () => {
    const row = session({
      isActive: false,
      revokeReason: 'rotated',
      revokedAt: new Date(Date.now() - 5_000),
    });
    const { service } = setupRefresh(row, user());
    const result = await service.refresh(REFRESH_TOKEN);
    expect(result.user.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('token xoay vòng đã quá grace window → 401', async () => {
    const row = session({
      isActive: false,
      revokeReason: 'rotated',
      revokedAt: new Date(Date.now() - 60_000),
    });
    const { service } = setupRefresh(row, user());
    await expect(service.refresh(REFRESH_TOKEN)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('session bị thu hồi vì lý do khác (logout/ban) không được grace', async () => {
    const row = session({
      isActive: false,
      revokeReason: 'admin_banned',
      revokedAt: new Date(Date.now() - 5_000),
    });
    const { service } = setupRefresh(row, user());
    await expect(service.refresh(REFRESH_TOKEN)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refresh của user bị khóa → Forbidden dù session hợp lệ', async () => {
    const { service } = setupRefresh(
      session(),
      user({ status: UserStatus.BANNED }),
    );
    await expect(service.refresh(REFRESH_TOKEN)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('AuthService chặn tài khoản khóa/xóa', () => {
  it('login tài khoản BANNED → Forbidden', async () => {
    const { service } = setup(user({ status: UserStatus.BANNED }));
    await expect(
      service.login({ email: 'user@example.com', password: 'matkhau123' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('login tài khoản đã xóa mềm → Unauthorized', async () => {
    const { service } = setup(user({ deletedAt: new Date() }));
    await expect(
      service.login({ email: 'user@example.com', password: 'matkhau123' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('loginWithGoogle tài khoản đã xóa → bị chặn, KHÔNG tạo user mới', async () => {
    const { service, createUser } = setup(user({ deletedAt: new Date() }));
    await expect(
      service.loginWithGoogle({
        googleId: 'google-1',
        email: 'user@example.com',
        fullName: 'Người Dùng',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('login tài khoản bình thường vẫn hoạt động', async () => {
    const { service, updateLastLogin } = setup(user());
    const result = await service.login({
      email: 'user@example.com',
      password: 'matkhau123',
    });
    expect(result.user.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(updateLastLogin).toHaveBeenCalled();
  });
});
