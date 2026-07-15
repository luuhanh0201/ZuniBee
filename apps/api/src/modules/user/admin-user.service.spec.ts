import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { UserRole, UserStatus } from '@zunibee/shared';
import { AdminUserService } from './admin-user.service';
import type { User } from './entities/user.entity';
import type { UserSession } from '@/modules/auth/entities/user-session.entity';

const ADMIN_ID = '00000000-0000-4000-8000-00000000000a';

function user(overrides: Partial<User> = {}): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'student@example.com',
    fullName: 'Học Sinh',
    phone: null,
    avatar: null,
    role: UserRole.STUDENT,
    roleSelected: true,
    status: UserStatus.ACTIVE,
    lastLoginAt: null,
    isVerify: true,
    provider: null,
    deletedAt: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  } as User;
}

function setup(target: User | null) {
  const usersDelete = jest.fn().mockResolvedValue(undefined);
  const sessionsUpdate = jest.fn().mockResolvedValue(undefined);
  const users = {
    findOne: jest.fn().mockResolvedValue(target),
    save: jest.fn((value: User) => Promise.resolve(value)),
    delete: usersDelete,
  } as unknown as Repository<User>;
  const sessions = {
    update: sessionsUpdate,
  } as unknown as Repository<UserSession>;
  const dataSource = { query: jest.fn() } as unknown as DataSource;
  return {
    service: new AdminUserService(users, sessions, dataSource),
    usersDelete,
    sessionsUpdate,
  };
}

describe('AdminUserService guards', () => {
  it('chặn thao tác lên chính mình', async () => {
    const { service } = setup(user({ id: ADMIN_ID, role: UserRole.ADMIN }));
    await expect(
      service.updateStatus(ADMIN_ID, UserStatus.BANNED, ADMIN_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('chặn thao tác lên admin khác', async () => {
    const { service } = setup(user({ role: UserRole.ADMIN }));
    await expect(
      service.softDelete('00000000-0000-4000-8000-000000000001', ADMIN_ID),
    ).rejects.toThrow('quản trị khác');
  });
});

describe('AdminUserService mutations', () => {
  it('khóa tài khoản thì thu hồi toàn bộ session', async () => {
    const target = user();
    const { service, sessionsUpdate } = setup(target);
    const result = await service.updateStatus(
      target.id,
      UserStatus.BANNED,
      ADMIN_ID,
    );
    expect(result.status).toBe(UserStatus.BANNED);
    expect(sessionsUpdate).toHaveBeenCalledWith(
      { userId: target.id, isActive: true },
      expect.objectContaining({
        isActive: false,
        revokeReason: 'admin_banned',
      }),
    );
  });

  it('đổi role set roleSelected và thu hồi session', async () => {
    const target = user();
    const { service, sessionsUpdate } = setup(target);
    const result = await service.updateRole(
      target.id,
      UserRole.TEACHER,
      ADMIN_ID,
    );
    expect(result.role).toBe(UserRole.TEACHER);
    expect(target.roleSelected).toBe(true);
    expect(sessionsUpdate).toHaveBeenCalledWith(
      { userId: target.id, isActive: true },
      expect.objectContaining({ revokeReason: 'admin_role_changed' }),
    );
  });

  it('xóa mềm set deletedAt + revoke; xóa lần hai bị chặn', async () => {
    const target = user();
    const { service, sessionsUpdate } = setup(target);
    await service.softDelete(target.id, ADMIN_ID);
    expect(target.deletedAt).toBeInstanceOf(Date);
    expect(sessionsUpdate).toHaveBeenCalledWith(
      { userId: target.id, isActive: true },
      expect.objectContaining({ revokeReason: 'admin_deleted' }),
    );
    await expect(service.softDelete(target.id, ADMIN_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('restore chỉ áp dụng cho tài khoản đã xóa', async () => {
    const notDeleted = user();
    const first = setup(notDeleted);
    await expect(
      first.service.restore(notDeleted.id, ADMIN_ID),
    ).rejects.toThrow('chưa bị xóa');

    const deleted = user({ deletedAt: new Date() });
    const second = setup(deleted);
    const restored = await second.service.restore(deleted.id, ADMIN_ID);
    expect(restored.deletedAt).toBeNull();
  });

  it('xóa cứng chỉ khi đã xóa mềm', async () => {
    const notDeleted = user();
    const first = setup(notDeleted);
    await expect(
      first.service.hardDelete(notDeleted.id, ADMIN_ID),
    ).rejects.toThrow('xóa mềm');
    expect(first.usersDelete).not.toHaveBeenCalled();

    const deleted = user({ deletedAt: new Date() });
    const second = setup(deleted);
    await second.service.hardDelete(deleted.id, ADMIN_ID);
    expect(second.usersDelete).toHaveBeenCalledWith(deleted.id);
  });
});
