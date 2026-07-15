import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import type {
  AiCreditAccount,
  AiCreditAdminUserPage,
  AiCreditLedgerEntry,
} from '@zunibee/shared';
import { User } from '@/modules/user/entities/user.entity';
import { AiCreditAccountEntity } from './entities/ai-credit-account.entity';
import {
  AiCreditLedgerEntity,
  AiCreditLedgerKind,
} from './entities/ai-credit-ledger.entity';

@Injectable()
export class AiCreditService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AiCreditAccountEntity)
    private readonly accounts: Repository<AiCreditAccountEntity>,
    @InjectRepository(AiCreditLedgerEntity)
    private readonly ledger: Repository<AiCreditLedgerEntity>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}
  async get(userId: string): Promise<AiCreditAccount> {
    const row = await this.accounts.findOne({ where: { userId } });
    return this.toAccount(
      row ??
        this.accounts.create({
          userId,
          balance: 0,
          reserved: 0,
          updatedAt: new Date(),
        }),
    );
  }
  async history(userId: string): Promise<AiCreditLedgerEntry[]> {
    return (
      await this.ledger.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 100,
      })
    ).map((row) => this.toLedger(row));
  }
  async searchUsers(
    query = '',
    requestedPage = 1,
    requestedPageSize = 20,
  ): Promise<AiCreditAdminUserPage> {
    const pageSize = Math.min(100, Math.max(5, requestedPageSize));
    const base = this.users.createQueryBuilder('user');
    applyUserSearch(base, query);
    const [total, roleRows, totalsRaw] = await Promise.all([
      base.clone().getCount(),
      base
        .clone()
        .select('user.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .groupBy('user.role')
        .getRawMany<{ role: string; count: string }>(),
      (() => {
        const totals = this.users
          .createQueryBuilder('user')
          .leftJoin(
            AiCreditAccountEntity,
            'account',
            'account.user_id = user.id',
          )
          .select('COALESCE(SUM(account.balance), 0)', 'balance')
          .addSelect('COALESCE(SUM(account.reserved), 0)', 'reserved');
        applyUserSearch(totals, query);
        return totals.getRawOne<{ balance: string; reserved: string }>();
      })(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(totalPages, Math.max(1, requestedPage));
    const userRows = await base
      .clone()
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    const accounts = userRows.length
      ? await this.accounts.findBy(
          userRows.map((user) => ({ userId: user.id })),
        )
      : [];
    const byUser = new Map(
      accounts.map((account) => [account.userId, account]),
    );
    const balance = Number(totalsRaw?.balance ?? 0);
    const reserved = Number(totalsRaw?.reserved ?? 0);
    const roleCounts = Object.fromEntries(
      roleRows.map((row) => [row.role, Number(row.count)]),
    );
    return {
      items: userRows.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        credit: this.toAccount(
          byUser.get(user.id) ??
            this.accounts.create({
              userId: user.id,
              balance: 0,
              reserved: 0,
              updatedAt: new Date(),
            }),
        ),
      })),
      pagination: { page, pageSize, total, totalPages },
      totals: { balance, reserved, available: balance - reserved },
      roleCounts: {
        student: roleCounts.student ?? 0,
        teacher: roleCounts.teacher ?? 0,
        admin: roleCounts.admin ?? 0,
      },
    };
  }
  async grant(
    userId: string,
    amount: number,
    adminId: string,
    note?: string,
  ): Promise<AiCreditAccount> {
    if (!(await this.users.exists({ where: { id: userId } })))
      throw new NotFoundException('Người dùng không tồn tại');
    const referenceId = crypto.randomUUID();
    return this.mutate(
      userId,
      `grant:${referenceId}`,
      async (manager, account) => {
        account.balance += amount;
        await manager.save(account);
        await manager.save(
          manager.create(AiCreditLedgerEntity, {
            userId,
            kind: AiCreditLedgerKind.GRANT,
            amount,
            balanceAfter: account.balance,
            reservedAfter: account.reserved,
            referenceType: 'admin_grant',
            referenceId,
            idempotencyKey: `grant:${referenceId}`,
            note: note ?? null,
            createdBy: adminId,
          }),
        );
        return account;
      },
    );
  }
  async reserve(
    userId: string,
    referenceType: string,
    referenceId: string,
    amount: number,
  ): Promise<AiCreditAccount> {
    if (amount <= 0) return this.get(userId);
    const key = `reserve:${referenceType}:${referenceId}`;
    return this.mutate(userId, key, async (manager, account) => {
      if (account.balance - account.reserved < amount)
        throw new HttpException(
          'Không đủ AI Credit để thực hiện yêu cầu',
          HttpStatus.PAYMENT_REQUIRED,
        );
      account.reserved += amount;
      await manager.save(account);
      await manager.save(
        manager.create(AiCreditLedgerEntity, {
          userId,
          kind: AiCreditLedgerKind.RESERVE,
          amount,
          balanceAfter: account.balance,
          reservedAfter: account.reserved,
          referenceType,
          referenceId,
          idempotencyKey: key,
          note: null,
          createdBy: null,
        }),
      );
      return account;
    });
  }
  async settle(
    userId: string,
    referenceType: string,
    referenceId: string,
    reserved: number,
    charged: number,
  ): Promise<AiCreditAccount> {
    const { safeCharge } = resolveCreditSettlement(reserved, charged);
    const key = `settle:${referenceType}:${referenceId}`;
    return this.mutate(userId, key, async (manager, account) => {
      account.reserved = Math.max(0, account.reserved - reserved);
      account.balance = Math.max(0, account.balance - safeCharge);
      await manager.save(account);
      if (safeCharge > 0)
        await manager.save(
          manager.create(AiCreditLedgerEntity, {
            userId,
            kind: AiCreditLedgerKind.CONSUME,
            amount: safeCharge,
            balanceAfter: account.balance,
            reservedAfter: account.reserved,
            referenceType,
            referenceId,
            idempotencyKey: key,
            note: null,
            createdBy: null,
          }),
        );
      if (reserved - safeCharge > 0)
        await manager.save(
          manager.create(AiCreditLedgerEntity, {
            userId,
            kind: AiCreditLedgerKind.RELEASE,
            amount: reserved - safeCharge,
            balanceAfter: account.balance,
            reservedAfter: account.reserved,
            referenceType,
            referenceId,
            idempotencyKey: `release-after-settle:${referenceType}:${referenceId}`,
            note: 'Hoàn phần credit dự phòng chưa dùng',
            createdBy: null,
          }),
        );
      return account;
    });
  }
  async release(
    userId: string,
    referenceType: string,
    referenceId: string,
    amount: number,
  ): Promise<AiCreditAccount> {
    if (amount <= 0) return this.get(userId);
    const key = `release:${referenceType}:${referenceId}`;
    return this.mutate(userId, key, async (manager, account) => {
      account.reserved = Math.max(0, account.reserved - amount);
      await manager.save(account);
      await manager.save(
        manager.create(AiCreditLedgerEntity, {
          userId,
          kind: AiCreditLedgerKind.RELEASE,
          amount,
          balanceAfter: account.balance,
          reservedAfter: account.reserved,
          referenceType,
          referenceId,
          idempotencyKey: key,
          note: 'Hoàn credit do tác vụ thất bại',
          createdBy: null,
        }),
      );
      return account;
    });
  }
  private async mutate(
    userId: string,
    key: string,
    action: (
      manager: EntityManager,
      account: AiCreditAccountEntity,
    ) => Promise<AiCreditAccountEntity>,
  ): Promise<AiCreditAccount> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(AiCreditLedgerEntity, {
        where: { idempotencyKey: key },
      });
      if (existing)
        return this.toAccount(await this.lockAccount(manager, userId));
      const account = await this.lockAccount(manager, userId);
      return this.toAccount(await action(manager, account));
    });
  }
  private async lockAccount(
    manager: EntityManager,
    userId: string,
  ): Promise<AiCreditAccountEntity> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(AiCreditAccountEntity)
      .values({ userId, balance: 0, reserved: 0 })
      .orIgnore()
      .execute();
    return manager.findOneOrFail(AiCreditAccountEntity, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
  }
  private toAccount(row: AiCreditAccountEntity): AiCreditAccount {
    return {
      userId: row.userId,
      balance: row.balance,
      reserved: row.reserved,
      available: row.balance - row.reserved,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private toLedger(row: AiCreditLedgerEntity): AiCreditLedgerEntry {
    return {
      id: row.id,
      kind: row.kind,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      reservedAfter: row.reservedAfter,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function applyUserSearch(
  builder: SelectQueryBuilder<User>,
  query: string,
): SelectQueryBuilder<User> {
  // Trang AI Credit không thao tác trên user đã xóa mềm.
  builder.andWhere('user.deleted_at IS NULL');
  const normalized = query.trim().toLowerCase();
  if (normalized)
    builder.andWhere(
      '(LOWER(user.email) LIKE :userQuery OR LOWER(user.fullName) LIKE :userQuery)',
      { userQuery: `%${normalized}%` },
    );
  return builder;
}

export function resolveCreditSettlement(
  reserved: number,
  charged: number,
): { safeCharge: number; released: number } {
  const safeReserved = Math.max(0, Math.floor(reserved));
  const safeCharge = Math.max(0, Math.min(safeReserved, Math.floor(charged)));
  return { safeCharge, released: safeReserved - safeCharge };
}
