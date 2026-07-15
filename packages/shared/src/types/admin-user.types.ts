import type { UserRole } from "../enums/user-role.enum";
import type { UserStatus } from "../enums/user-status.enum";

/** Bộ lọc trạng thái ở trang admin: deleted là trạng thái dẫn xuất từ deletedAt. */
export type AdminUserStatusFilter = "active" | "banned" | "deleted";

export type AdminUser = {
  id: string;
  email: string | null;
  fullName: string;
  avatar: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  isVerify: boolean;
  provider: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type AdminUserPage = {
  items: AdminUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  roleCounts: { student: number; teacher: number; admin: number };
  statusCounts: { active: number; banned: number; deleted: number };
};

export type AdminUserDetail = AdminUser & {
  stats: {
    classroomsTaught: number;
    classroomsJoined: number;
    quizzesCreated: number;
    quizAttempts: number;
  };
  credit: { balance: number; reserved: number; available: number };
};

export type AdminUpdateUserStatusRequest = {
  status: UserStatus.ACTIVE | UserStatus.BANNED;
};

export type AdminUpdateUserRoleRequest = { role: UserRole };

export type AdminListUsersFilters = {
  page?: number;
  pageSize?: number;
  query?: string;
  role?: UserRole;
  status?: AdminUserStatusFilter;
};
