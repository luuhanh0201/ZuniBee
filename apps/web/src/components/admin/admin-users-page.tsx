"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  CircleDollarSign,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundX,
  X,
} from "lucide-react";
import {
  UserRole,
  UserStatus,
  type AdminListUsersFilters,
  type AdminUserDetail,
  type AdminUserPage,
  type AdminUserStatusFilter,
} from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast-provider";
import { SelectMenu } from "@/components/ui/select-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MetricCard, formatNumber } from "@/components/ai/metric-card";
import { Pagination } from "@/components/admin/pagination";
import { adminGrantAiCredit } from "@/components/ai/ai-api";
import {
  adminGetUser,
  adminHardDeleteUser,
  adminListUsers,
  adminRestoreUser,
  adminSoftDeleteUser,
  adminUpdateUserRole,
  adminUpdateUserStatus,
} from "@/components/admin/admin-user-api";

type RoleFilter = UserRole | "all";
type StatusFilter = AdminUserStatusFilter | "all";
type ConfirmKind =
  | "ban"
  | "unban"
  | "role"
  | "soft-delete"
  | "restore"
  | "hard-delete";

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.STUDENT]: "Học sinh",
  [UserRole.TEACHER]: "Giáo viên",
  [UserRole.ADMIN]: "Quản trị",
};

export function AdminUsersPage() {
  const { accessToken, user: me } = useAuth();
  const { showToast } = useToast();
  const [result, setResult] = useState<AdminUserPage>(EMPTY_RESULT);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole>(UserRole.STUDENT);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantAmount, setGrantAmount] = useState(50);

  const load = useCallback(
    async (
      overrides: Partial<AdminListUsersFilters> & { silent?: boolean } = {},
    ) => {
      if (!accessToken) return;
      if (!overrides.silent) setLoading(true);
      try {
        setResult(
          await adminListUsers(
            {
              query: overrides.query ?? appliedQuery,
              role:
                (overrides.role ?? (roleFilter === "all" ? undefined : roleFilter)) ||
                undefined,
              status:
                (overrides.status ??
                  (statusFilter === "all" ? undefined : statusFilter)) ||
                undefined,
              page: overrides.page ?? result.pagination.page,
              pageSize: overrides.pageSize ?? result.pagination.pageSize,
            },
            accessToken,
          ),
        );
        setError("");
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Không tải được người dùng",
        );
      } finally {
        setLoading(false);
      }
    },
    [accessToken, appliedQuery, roleFilter, statusFilter, result.pagination],
  );

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    adminListUsers({ page: 1, pageSize: 20 }, accessToken)
      .then((response) => {
        if (!active) return;
        setResult(response);
        setError("");
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không tải được người dùng",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  async function openDetail(id: string) {
    if (!accessToken) return;
    setDetailLoading(true);
    try {
      const data = await adminGetUser(id, accessToken);
      setDetail(data);
      setPendingRole(data.role);
    } catch (cause) {
      showToast(
        "error",
        cause instanceof Error ? cause.message : "Không tải được chi tiết",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function runAction(kind: ConfirmKind) {
    if (!accessToken || !detail) return;
    setActionLoading(true);
    try {
      if (kind === "ban")
        await adminUpdateUserStatus(
          detail.id,
          { status: UserStatus.BANNED },
          accessToken,
        );
      else if (kind === "unban")
        await adminUpdateUserStatus(
          detail.id,
          { status: UserStatus.ACTIVE },
          accessToken,
        );
      else if (kind === "role")
        await adminUpdateUserRole(detail.id, { role: pendingRole }, accessToken);
      else if (kind === "soft-delete")
        await adminSoftDeleteUser(detail.id, accessToken);
      else if (kind === "restore") await adminRestoreUser(detail.id, accessToken);
      else await adminHardDeleteUser(detail.id, accessToken);

      showToast("success", ACTION_SUCCESS[kind]);
      setConfirm(null);
      if (kind === "hard-delete") setDetail(null);
      else await openDetail(detail.id);
      await load({ silent: true });
    } catch (cause) {
      showToast(
        "error",
        cause instanceof Error ? cause.message : "Thao tác thất bại",
      );
    } finally {
      setActionLoading(false);
    }
  }

  const users = result.items;
  const canMutate = Boolean(
    detail && detail.id !== me?.id && detail.role !== UserRole.ADMIN,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          User management
        </p>
        <h2 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
          Quản lý người dùng
        </h2>
        <p className="mt-2 font-semibold text-muted-foreground">
          Tìm kiếm, khóa/mở, đổi vai trò, xóa mềm và khôi phục tài khoản.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={UserRound}
          label="Tổng kết quả"
          value={formatNumber(result.pagination.total)}
          helper={appliedQuery ? "Theo bộ lọc hiện tại" : "Theo bộ lọc"}
          color="bg-secondary-soft"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Đang hoạt động"
          value={formatNumber(result.statusCounts.active)}
          helper="Chưa bị khóa/xóa"
          color="bg-success-soft"
        />
        <MetricCard
          icon={Ban}
          label="Bị khóa"
          value={formatNumber(result.statusCounts.banned)}
          helper="Không đăng nhập được"
          color="bg-warning-soft"
        />
        <MetricCard
          icon={UserRoundX}
          label="Đã xóa"
          value={formatNumber(result.statusCounts.deleted)}
          helper="Xóa mềm, khôi phục được"
          color="bg-destructive-soft"
        />
      </section>

      <section className="rounded-2xl border-2 border-foreground bg-surface shadow-brutal-md">
        <div className="flex flex-col gap-3 border-b-2 border-foreground p-4 lg:flex-row lg:items-center">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedQuery(query.trim());
              void load({ query: query.trim(), page: 1 });
            }}
            className="flex flex-1 gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tên hoặc email"
                className="min-h-11 w-full rounded-xl border-2 border-foreground bg-background pl-10 pr-3 font-bold outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button className="cursor-pointer rounded-xl border-2 border-foreground bg-primary px-5 font-extrabold shadow-brutal-sm">
              Tìm
            </button>
          </form>
          <div className="grid grid-cols-2 gap-3 lg:w-[380px]">
            <SelectMenu
              value={roleFilter}
              onChange={(value) => {
                setRoleFilter(value as RoleFilter);
                void load({
                  role: value === "all" ? undefined : (value as UserRole),
                  page: 1,
                });
              }}
              options={[
                { value: "all", label: "Mọi vai trò" },
                { value: UserRole.STUDENT, label: "Học sinh" },
                { value: UserRole.TEACHER, label: "Giáo viên" },
                { value: UserRole.ADMIN, label: "Quản trị" },
              ]}
            />
            <SelectMenu
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value as StatusFilter);
                void load({
                  status:
                    value === "all"
                      ? undefined
                      : (value as AdminUserStatusFilter),
                  page: 1,
                });
              }}
              options={[
                { value: "all", label: "Chưa xóa (mặc định)" },
                { value: "active", label: "Đang hoạt động" },
                { value: "banned", label: "Bị khóa" },
                { value: "deleted", label: "Đã xóa" },
              ]}
            />
          </div>
        </div>

        {error ? (
          <p className="m-4 rounded-xl border-2 border-destructive bg-destructive-soft p-3 font-bold">
            {error}
          </p>
        ) : null}
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 font-bold text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Đang tải...
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b-2 border-foreground text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Người dùng</th>
                  <th className="px-3 py-2">Vai trò</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Đăng nhập gần nhất</th>
                  <th className="px-3 py-2">Ngày tạo</th>
                  <th className="px-3 py-2 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-b border-divider font-semibold ${user.deletedAt ? "opacity-60" : ""}`}
                  >
                    <td className="px-3 py-3">
                      <strong className="block">{user.fullName}</strong>
                      <small className="text-muted-foreground">
                        {user.email ?? "Chưa có email"}
                      </small>
                    </td>
                    <td className="px-3 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        status={user.status}
                        deleted={Boolean(user.deletedAt)}
                      />
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {user.lastLoginAt
                        ? formatDateTime(user.lastLoginAt)
                        : "Chưa đăng nhập"}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetail(user.id)}
                        disabled={detailLoading}
                        className="cursor-pointer rounded-xl border-2 border-foreground bg-secondary-soft px-3 py-2 font-extrabold hover:shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading ? (
          <Pagination
            {...result.pagination}
            itemLabel="người dùng"
            onPageChange={(page) => void load({ page })}
            onPageSizeChange={(pageSize) => void load({ page: 1, pageSize })}
          />
        ) : null}
      </section>

      {detail ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-detail-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-0 sm:items-center sm:p-4"
        >
          <div className="max-h-[95dvh] w-full overflow-y-auto rounded-t-3xl border-[3px] border-foreground bg-background shadow-brutal-xl sm:max-w-2xl sm:rounded-3xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b-2 border-foreground bg-primary p-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                  Chi tiết người dùng
                </p>
                <h3
                  id="user-detail-title"
                  className="mt-1 font-display text-2xl font-extrabold"
                >
                  {detail.fullName}
                </h3>
                <p className="font-semibold">
                  {detail.email ?? "Chưa có email"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Đóng"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground bg-surface shadow-brutal-sm"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="space-y-5 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={detail.role} />
                <StatusBadge
                  status={detail.status}
                  deleted={Boolean(detail.deletedAt)}
                />
                {detail.provider ? (
                  <span className="inline-flex rounded-full border-2 border-foreground bg-surface px-2.5 py-1 text-xs font-extrabold">
                    Đăng nhập qua {detail.provider}
                  </span>
                ) : null}
              </div>

              <dl className="grid gap-3 rounded-2xl border-2 border-foreground bg-surface p-4 font-semibold sm:grid-cols-2">
                <InfoRow label="Ngày tạo" value={formatDateTime(detail.createdAt)} />
                <InfoRow
                  label="Đăng nhập gần nhất"
                  value={
                    detail.lastLoginAt
                      ? formatDateTime(detail.lastLoginAt)
                      : "Chưa đăng nhập"
                  }
                />
                <InfoRow
                  label="Lớp đang dạy / tham gia"
                  value={`${formatNumber(detail.stats.classroomsTaught)} / ${formatNumber(detail.stats.classroomsJoined)}`}
                />
                <InfoRow
                  label="Quiz đã tạo / lượt làm"
                  value={`${formatNumber(detail.stats.quizzesCreated)} / ${formatNumber(detail.stats.quizAttempts)}`}
                />
                <InfoRow
                  label="AI Credit khả dụng"
                  value={formatNumber(detail.credit.available)}
                />
                {detail.deletedAt ? (
                  <InfoRow
                    label="Đã xóa lúc"
                    value={formatDateTime(detail.deletedAt)}
                  />
                ) : null}
              </dl>

              {canMutate ? (
                <div className="space-y-4">
                  {!detail.deletedAt ? (
                    <>
                      <div className="flex flex-wrap gap-3">
                        {detail.status === UserStatus.BANNED ? (
                          <ActionButton
                            icon={RotateCcw}
                            label="Mở khóa"
                            color="bg-success-soft"
                            onClick={() => setConfirm("unban")}
                          />
                        ) : (
                          <ActionButton
                            icon={Ban}
                            label="Khóa tài khoản"
                            color="bg-warning-soft"
                            onClick={() => setConfirm("ban")}
                          />
                        )}
                        <ActionButton
                          icon={CircleDollarSign}
                          label="Cấp credit"
                          color="bg-success-soft"
                          onClick={() => setGrantOpen(true)}
                        />
                        <ActionButton
                          icon={Trash2}
                          label="Xóa mềm"
                          color="bg-destructive-soft"
                          onClick={() => setConfirm("soft-delete")}
                        />
                      </div>
                      <div className="flex flex-wrap items-end gap-3 rounded-2xl border-2 border-foreground bg-surface p-4">
                        <label className="block flex-1 font-extrabold">
                          Đổi vai trò
                          <SelectMenu
                            className="mt-2"
                            value={pendingRole}
                            onChange={(value) =>
                              setPendingRole(value as UserRole)
                            }
                            options={[
                              { value: UserRole.STUDENT, label: "Học sinh" },
                              { value: UserRole.TEACHER, label: "Giáo viên" },
                              {
                                value: UserRole.ADMIN,
                                label: "Quản trị",
                                title:
                                  "Sau khi lên quản trị sẽ không thể hạ cấp qua giao diện",
                              },
                            ]}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={pendingRole === detail.role}
                          onClick={() => setConfirm("role")}
                          className="min-h-11 cursor-pointer rounded-xl border-2 border-foreground bg-primary px-4 font-extrabold shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Áp dụng
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <ActionButton
                        icon={RotateCcw}
                        label="Khôi phục"
                        color="bg-success-soft"
                        onClick={() => setConfirm("restore")}
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Xóa vĩnh viễn"
                        color="bg-destructive-soft"
                        onClick={() => setConfirm("hard-delete")}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-xl border-2 border-foreground bg-surface-soft p-3 font-bold text-muted-foreground">
                  {detail.id === me?.id
                    ? "Không thể thao tác trên tài khoản của chính bạn."
                    : "Không thể thao tác trên tài khoản quản trị khác."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm === "ban"}
        title="Khóa tài khoản?"
        description={`${detail?.fullName ?? ""} sẽ không đăng nhập được và bị thu hồi mọi phiên hiện tại. Mở khóa lại được bất kỳ lúc nào.`}
        confirmLabel="Khóa"
        loading={actionLoading}
        onConfirm={() => void runAction("ban")}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "unban"}
        title="Mở khóa tài khoản?"
        description={`${detail?.fullName ?? ""} sẽ đăng nhập lại được ngay.`}
        confirmLabel="Mở khóa"
        loading={actionLoading}
        onConfirm={() => void runAction("unban")}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "role"}
        title="Đổi vai trò?"
        description={`Đổi ${detail?.fullName ?? ""} thành ${ROLE_LABELS[pendingRole]}. Người dùng sẽ bị đăng xuất và phải đăng nhập lại.`}
        confirmLabel="Đổi vai trò"
        loading={actionLoading}
        onConfirm={() => void runAction("role")}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "soft-delete"}
        title="Xóa mềm tài khoản?"
        description={`${detail?.fullName ?? ""} sẽ bị chặn đăng nhập và ẩn khỏi hệ thống. Lớp học, quiz và kết quả của họ GIỮ NGUYÊN — học sinh vẫn xem được. Khôi phục được bất kỳ lúc nào.`}
        confirmLabel="Xóa mềm"
        loading={actionLoading}
        onConfirm={() => void runAction("soft-delete")}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "restore"}
        title="Khôi phục tài khoản?"
        description={`${detail?.fullName ?? ""} sẽ đăng nhập lại được với trạng thái trước khi xóa.`}
        confirmLabel="Khôi phục"
        loading={actionLoading}
        onConfirm={() => void runAction("restore")}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "hard-delete"}
        title="Xóa vĩnh viễn?"
        tone="danger"
        description={
          <>
            Hành động này <strong>không thể hoàn tác</strong>. Toàn bộ dữ liệu
            của {detail?.fullName ?? ""} sẽ bị xóa theo: lớp học và thành viên,
            quiz và câu hỏi, lượt làm bài, ví AI Credit và lịch sử giao dịch.
          </>
        }
        confirmLabel="Xóa vĩnh viễn"
        requireText={detail?.email ?? detail?.fullName ?? ""}
        loading={actionLoading}
        onConfirm={() => void runAction("hard-delete")}
        onClose={() => setConfirm(null)}
      />

      {grantOpen && detail ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/50 p-4">
          <form
            className="w-full max-w-md rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-lg"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!accessToken) return;
              setActionLoading(true);
              try {
                await adminGrantAiCredit(
                  { userId: detail.id, amount: grantAmount },
                  accessToken,
                );
                showToast("success", `Đã cấp ${grantAmount} credit.`);
                setGrantOpen(false);
                await openDetail(detail.id);
              } catch (cause) {
                showToast(
                  "error",
                  cause instanceof Error
                    ? cause.message
                    : "Không thể cấp credit",
                );
              } finally {
                setActionLoading(false);
              }
            }}
          >
            <h3 className="font-display text-2xl font-extrabold">
              Cấp AI Credit
            </h3>
            <p className="mt-1 font-semibold text-muted-foreground">
              {detail.fullName} · khả dụng{" "}
              {formatNumber(detail.credit.available)}
            </p>
            <label className="mt-4 block font-extrabold">
              Số credit
              <input
                type="number"
                min={1}
                max={1_000_000}
                required
                value={grantAmount}
                onChange={(event) => setGrantAmount(Number(event.target.value))}
                className="mt-2 min-h-11 w-full rounded-xl border-2 border-foreground bg-background px-3 font-semibold outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setGrantOpen(false)}
                className="min-h-11 cursor-pointer rounded-xl border-2 border-foreground bg-surface px-4 font-extrabold hover:bg-surface-soft"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 font-extrabold shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Cấp credit
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

const ACTION_SUCCESS: Record<ConfirmKind, string> = {
  ban: "Đã khóa tài khoản và thu hồi phiên đăng nhập.",
  unban: "Đã mở khóa tài khoản.",
  role: "Đã đổi vai trò — người dùng sẽ phải đăng nhập lại.",
  "soft-delete": "Đã xóa mềm tài khoản. Có thể khôi phục trong bộ lọc Đã xóa.",
  restore: "Đã khôi phục tài khoản.",
  "hard-delete": "Đã xóa vĩnh viễn tài khoản và toàn bộ dữ liệu liên quan.",
};

const EMPTY_RESULT: AdminUserPage = {
  items: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  roleCounts: { student: 0, teacher: 0, admin: 0 },
  statusCounts: { active: 0, banned: 0, deleted: 0 },
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: typeof Ban;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-foreground px-4 font-extrabold shadow-brutal-sm transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-md ${color}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const label =
    role === "admin"
      ? "Quản trị"
      : role === "teacher"
        ? "Giáo viên"
        : "Học sinh";
  const color =
    role === "admin"
      ? "bg-primary"
      : role === "teacher"
        ? "bg-secondary-soft"
        : "bg-success-soft";
  return (
    <span
      className={`inline-flex rounded-full border-2 border-foreground px-2.5 py-1 text-xs font-extrabold ${color}`}
    >
      {label}
    </span>
  );
}

function StatusBadge({
  status,
  deleted,
}: {
  status: UserStatus;
  deleted: boolean;
}) {
  if (deleted)
    return (
      <span className="inline-flex rounded-full border-2 border-foreground bg-surface-soft px-2.5 py-1 text-xs font-extrabold text-muted-foreground">
        Đã xóa
      </span>
    );
  if (status === UserStatus.BANNED)
    return (
      <span className="inline-flex rounded-full border-2 border-foreground bg-destructive-soft px-2.5 py-1 text-xs font-extrabold">
        Bị khóa
      </span>
    );
  return (
    <span className="inline-flex rounded-full border-2 border-foreground bg-success-soft px-2.5 py-1 text-xs font-extrabold">
      Hoạt động
    </span>
  );
}
