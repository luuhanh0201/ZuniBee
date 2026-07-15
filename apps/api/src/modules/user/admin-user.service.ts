import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import {
  UserRole,
  UserStatus,
  type AdminListUsersFilters,
  type AdminUser,
  type AdminUserDetail,
  type AdminUserPage,
  type AdminUserStatusFilter,
} from '@zunibee/shared';
import { User } from '@/modules/user/entities/user.entity';
import { UserSession } from '@/modules/auth/entities/user-session.entity';

type StatusCountRow = { bucket: AdminUserStatusFilter; count: string };
type RoleCountRow = { role: string; count: string };
type DetailStatsRow = {
  classrooms_taught: string;
  classrooms_joined: string;
  quizzes_created: string;
  quiz_attempts: string;
  balance: string;
  reserved: string;
};

@Injectable()
export class AdminUserService {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    // Inject thẳng repository session thay vì AuthService để tránh phụ thuộc
    // vòng UserModule ↔ AuthModule; logic revoke chỉ là một câu update.
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
    private readonly dataSource: DataSource,
  ) {}

  async list(filters: AdminListUsersFilters): Promise<AdminUserPage> {
    const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 20));
    const base = this.users.createQueryBuilder('user');
    applySearch(base, filters.query ?? '');
    if (filters.role)
      base.andWhere('user.role = :role', { role: filters.role });
    applyStatusFilter(base, filters.status);

    const countsBase = this.users.createQueryBuilder('user');
    applySearch(countsBase, filters.query ?? '');
    if (filters.role)
      countsBase.andWhere('user.role = :role', { role: filters.role });

    const [total, roleRows, statusRows] = await Promise.all([
      base.clone().getCount(),
      countsBase
        .clone()
        .andWhere('user.deleted_at IS NULL')
        .select('user.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .groupBy('user.role')
        .getRawMany<RoleCountRow>(),
      countsBase
        .clone()
        .select(
          `CASE WHEN "user"."deleted_at" IS NOT NULL THEN 'deleted' ELSE "user"."status"::text END`,
          'bucket',
        )
        .addSelect('COUNT(*)', 'count')
        .groupBy('bucket')
        .getRawMany<StatusCountRow>(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(totalPages, Math.max(1, filters.page ?? 1));
    const rows = await base
      .clone()
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const statusCounts = { active: 0, banned: 0, deleted: 0 };
    for (const row of statusRows) {
      if (row.bucket in statusCounts)
        statusCounts[row.bucket] = Number(row.count);
    }
    const roleCounts = { student: 0, teacher: 0, admin: 0 };
    for (const row of roleRows) {
      if (row.role in roleCounts)
        roleCounts[row.role as keyof typeof roleCounts] = Number(row.count);
    }

    return {
      items: rows.map((row) => toAdminUser(row)),
      pagination: { page, pageSize, total, totalPages },
      roleCounts,
      statusCounts,
    };
  }

  async getDetail(id: string): Promise<AdminUserDetail> {
    const user = await this.findTarget(id);
    const [stats] = await this.dataSource.query<DetailStatsRow[]>(
      `SELECT
        (SELECT COUNT(*) FROM classrooms WHERE teacher_id = $1) AS classrooms_taught,
        (SELECT COUNT(*) FROM classroom_members WHERE user_id = $1) AS classrooms_joined,
        (SELECT COUNT(*) FROM quizzes WHERE teacher_id = $1) AS quizzes_created,
        (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = $1) AS quiz_attempts,
        COALESCE((SELECT balance FROM ai_credit_accounts WHERE user_id = $1), 0) AS balance,
        COALESCE((SELECT reserved FROM ai_credit_accounts WHERE user_id = $1), 0) AS reserved`,
      [id],
    );
    const balance = Number(stats?.balance ?? 0);
    const reserved = Number(stats?.reserved ?? 0);
    return {
      ...toAdminUser(user),
      stats: {
        classroomsTaught: Number(stats?.classrooms_taught ?? 0),
        classroomsJoined: Number(stats?.classrooms_joined ?? 0),
        quizzesCreated: Number(stats?.quizzes_created ?? 0),
        quizAttempts: Number(stats?.quiz_attempts ?? 0),
      },
      credit: { balance, reserved, available: balance - reserved },
    };
  }

  async updateStatus(
    targetId: string,
    status: UserStatus.ACTIVE | UserStatus.BANNED,
    adminId: string,
  ): Promise<AdminUser> {
    const target = await this.findTarget(targetId);
    this.assertMutableTarget(target, adminId);
    target.status = status;
    await this.users.save(target);
    if (status === UserStatus.BANNED) {
      await this.revokeAllSessions(targetId, 'admin_banned');
    }
    this.logger.log(
      `admin=${adminId} action=update_status status=${status} target=${targetId}`,
    );
    return toAdminUser(target);
  }

  async updateRole(
    targetId: string,
    role: UserRole,
    adminId: string,
  ): Promise<AdminUser> {
    const target = await this.findTarget(targetId);
    this.assertMutableTarget(target, adminId);
    target.role = role;
    target.roleSelected = true;
    await this.users.save(target);
    // JWT đang lưu hành chứa role cũ — thu hồi phiên để user đăng nhập lại.
    await this.revokeAllSessions(targetId, 'admin_role_changed');
    this.logger.log(
      `admin=${adminId} action=update_role role=${role} target=${targetId}`,
    );
    return toAdminUser(target);
  }

  async softDelete(targetId: string, adminId: string): Promise<void> {
    const target = await this.findTarget(targetId);
    this.assertMutableTarget(target, adminId);
    if (target.deletedAt)
      throw new BadRequestException('Tài khoản đã bị xóa trước đó');
    // Giữ nguyên status để restore trả về đúng trạng thái cũ.
    target.deletedAt = new Date();
    await this.users.save(target);
    await this.revokeAllSessions(targetId, 'admin_deleted');
    this.logger.log(`admin=${adminId} action=soft_delete target=${targetId}`);
  }

  async restore(targetId: string, adminId: string): Promise<AdminUser> {
    const target = await this.findTarget(targetId);
    if (!target.deletedAt)
      throw new BadRequestException('Tài khoản chưa bị xóa');
    target.deletedAt = null;
    await this.users.save(target);
    this.logger.log(`admin=${adminId} action=restore target=${targetId}`);
    return toAdminUser(target);
  }

  async hardDelete(targetId: string, adminId: string): Promise<void> {
    const target = await this.findTarget(targetId);
    this.assertMutableTarget(target, adminId);
    if (!target.deletedAt)
      throw new BadRequestException(
        'Chỉ có thể xóa vĩnh viễn tài khoản đã bị xóa mềm',
      );
    // FK CASCADE quét sessions/classrooms/quizzes/attempts/credit;
    // các cột audit (ledger.created_by, usage_events.user_id...) SET NULL.
    await this.users.delete(targetId);
    this.logger.warn(
      `admin=${adminId} action=HARD_DELETE target=${targetId} email=${target.email ?? 'null'} role=${target.role}`,
    );
  }

  private async findTarget(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    return user;
  }

  private assertMutableTarget(target: User, adminId: string): void {
    if (target.id === adminId)
      throw new ForbiddenException(
        'Không thể thao tác trên tài khoản của chính bạn',
      );
    if (target.role === UserRole.ADMIN)
      throw new ForbiddenException(
        'Không thể thao tác trên tài khoản quản trị khác',
      );
  }

  private async revokeAllSessions(
    userId: string,
    reason: string,
  ): Promise<void> {
    await this.sessions.update(
      { userId, isActive: true },
      { isActive: false, revokedAt: new Date(), revokeReason: reason },
    );
  }
}

function applySearch(
  builder: SelectQueryBuilder<User>,
  query: string,
): SelectQueryBuilder<User> {
  const normalized = query.trim().toLowerCase();
  if (normalized)
    builder.andWhere(
      '(LOWER(user.email) LIKE :userQuery OR LOWER(user.fullName) LIKE :userQuery)',
      { userQuery: `%${normalized}%` },
    );
  return builder;
}

function applyStatusFilter(
  builder: SelectQueryBuilder<User>,
  status?: AdminUserStatusFilter,
): void {
  if (status === 'deleted') {
    builder.andWhere('user.deleted_at IS NOT NULL');
    return;
  }
  builder.andWhere('user.deleted_at IS NULL');
  if (status === 'active' || status === 'banned')
    builder.andWhere('user.status = :status', { status });
}

function toAdminUser(user: User): AdminUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatar: user.avatar,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isVerify: user.isVerify,
    provider: user.provider ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}
